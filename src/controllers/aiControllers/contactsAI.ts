/**
 * Contacts AI endpoints.
 *
 *   POST /v1/ai/contacts/enrich   → { updated: EnrichedContact[] }
 *   POST /v1/ai/contacts/dedupe   → { duplicateGroups: [...], stale: [...] }
 *
 * Enrich uses a single batched LLM call for up to 10 contacts per request.
 * Dedupe is pure rule-based (email + normalised-name match) — free, deterministic,
 * fast; it's still surfaced as an "AI" affordance in the UI.
 */
import { Request, Response } from "express";
import { Op } from "sequelize";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Contacts from "../../models/Contacts";
import { aiService } from "../../utils/http/services/aiService";

const ENRICH_MAX = 10;
const STALE_MIN_AGE_DAYS = 60;

type EnrichCandidate = {
  contact_id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  raw_hint: string | null;
};

type EnrichedFields = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  title?: string | null;
  company?: string | null;
};

/* ============================================================
   Enrich
   ============================================================ */

export const contactsEnrichHandler = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  const rawIds = req.body?.contactIds;
  const ids: string[] = Array.isArray(rawIds)
    ? rawIds.filter((v): v is string => typeof v === "string").slice(0, ENRICH_MAX)
    : [];
  if (ids.length === 0) {
    sendResponse(res, 400, "contactIds is required (array of strings, max 10)");
    return;
  }

  try {
    const rows = await Contacts.findAll({
      where: { contact_id: { [Op.in]: ids }, user_id: userId },
    });
    if (rows.length === 0) {
      sendResponse(res, 200, "No matching contacts", { updated: [] });
      return;
    }

    const candidates: EnrichCandidate[] = rows.map((r) => {
      const j: any = r.get({ plain: true });
      const hintSource = j.raw_data || {};
      // Keep the hint tiny — we only need identity signals.
      const raw_hint =
        typeof hintSource === "object"
          ? [
              hintSource?.title,
              hintSource?.company,
              hintSource?.organization?.name,
              hintSource?.headline,
              hintSource?.signature,
            ]
              .filter(Boolean)
              .join(" | ")
              .slice(0, 400)
          : null;
      return {
        contact_id: j.contact_id,
        email: j.email || null,
        full_name: j.full_name || null,
        first_name: j.first_name || null,
        last_name: j.last_name || null,
        raw_hint,
      };
    });

    const messages = [
      {
        role: "system",
        content:
          "You infer missing B2B contact fields from an email address and any hint text. " +
          "Return ONLY a JSON object. NEVER invent values you can't derive from the input — " +
          "if a field is unknown, return null.",
      },
      {
        role: "user",
        content: [
          "Enrich these contacts. For each, return best-guess first_name, last_name, full_name, title, company.",
          "Rules:",
          "- Derive names from the local-part of the email if no other hint (jane.doe@acme.com → Jane Doe).",
          "- Derive company from the email domain when hint is empty (acme.com → Acme).",
          "- If you cannot confidently infer a field, return null for it.",
          "",
          "Input:",
          JSON.stringify(candidates),
          "",
          "Return JSON:",
          '{ "updated": [ { "contact_id": "...", "first_name": null, "last_name": null, "full_name": null, "title": null, "company": null } ] }',
        ].join("\n"),
      },
    ];

    const response = await aiService.request({
      messages,
      max_tokens: 900,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const enriched: Record<string, EnrichedFields> = {};
    const arr: any[] = Array.isArray(response.data?.updated) ? response.data.updated : [];
    for (const item of arr) {
      if (!item?.contact_id) continue;
      enriched[item.contact_id] = {
        first_name: cleanStr(item.first_name),
        last_name: cleanStr(item.last_name),
        full_name: cleanStr(item.full_name),
        title: cleanStr(item.title),
        company: cleanStr(item.company),
      };
    }

    // Persist — only overwrite fields that were empty on the row.
    const updates: any[] = [];
    for (const row of rows) {
      const j: any = row.get({ plain: true });
      const inferred = enriched[j.contact_id];
      if (!inferred) continue;
      const patch: any = {};
      if (!j.first_name && inferred.first_name) patch.first_name = inferred.first_name;
      if (!j.last_name && inferred.last_name) patch.last_name = inferred.last_name;
      if (!j.full_name && inferred.full_name) patch.full_name = inferred.full_name;
      // We don't store title/company on Contacts today; return them for the client
      // to render as a preview even if we don't persist yet.
      if (Object.keys(patch).length > 0 || !j.is_enriched) {
        await row.update({ ...patch, is_enriched: true });
        updates.push({
          contact_id: j.contact_id,
          ...patch,
          title: inferred.title || null,
          company: inferred.company || null,
          is_enriched: true,
        });
      }
    }

    sendResponse(res, 200, "Contacts enriched", { updated: updates });
  } catch (error: any) {
    logger.error(error, "Error enriching contacts");
    sendResponse(res, 500, "Failed to enrich contacts", null, error.message);
  }
};

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s.slice(0, 120) : null;
}

/* ============================================================
   Dedupe (rule-based)
   ============================================================ */

export const contactsDedupeHandler = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  try {
    const rows = await Contacts.findAll({
      where: { user_id: userId },
      attributes: [
        "contact_id",
        "email",
        "full_name",
        "first_name",
        "last_name",
        "is_complete",
        "is_enriched",
        "validation_required",
        "updatedAt",
      ],
      raw: true,
    });

    // 1. Email-based duplicate groups.
    const byEmail = new Map<string, any[]>();
    for (const r of rows as any[]) {
      const key = (r.email || "").trim().toLowerCase();
      if (!key) continue;
      const bucket = byEmail.get(key) || [];
      bucket.push(r);
      byEmail.set(key, bucket);
    }
    const duplicateGroups: {
      reason: string;
      contacts: { id: string; name: string | null; email: string | null }[];
    }[] = [];
    for (const [email, bucket] of byEmail) {
      if (bucket.length < 2) continue;
      duplicateGroups.push({
        reason: `Same email address (${email})`,
        contacts: bucket.map((c) => ({
          id: c.contact_id,
          name: c.full_name,
          email: c.email,
        })),
      });
    }

    // 2. Name-based near-duplicates (same normalised first + last).
    const byName = new Map<string, any[]>();
    for (const r of rows as any[]) {
      const first = (r.first_name || "").trim().toLowerCase();
      const last = (r.last_name || "").trim().toLowerCase();
      if (!first && !last) continue;
      const key = `${first}|${last}`;
      const bucket = byName.get(key) || [];
      bucket.push(r);
      byName.set(key, bucket);
    }
    for (const [key, bucket] of byName) {
      if (bucket.length < 2) continue;
      // Skip if all these were already grouped by identical email.
      const emails = new Set(bucket.map((c) => (c.email || "").toLowerCase()).filter(Boolean));
      if (emails.size <= 1 && emails.size > 0) continue;
      duplicateGroups.push({
        reason: `Same name (${key.replace("|", " ")})`,
        contacts: bucket.map((c) => ({
          id: c.contact_id,
          name: c.full_name,
          email: c.email,
        })),
      });
    }

    // 3. Stale rows — validation_required or (not enriched, missing fields, > N days old).
    const staleCutoff = Date.now() - STALE_MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
    const stale: { id: string; name: string | null; email: string | null; reason: string }[] = [];
    for (const r of rows as any[]) {
      if (r.validation_required) {
        stale.push({
          id: r.contact_id,
          name: r.full_name,
          email: r.email,
          reason: "Needs manual validation",
        });
        continue;
      }
      const age = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      if (!r.is_enriched && age && age < staleCutoff) {
        stale.push({
          id: r.contact_id,
          name: r.full_name,
          email: r.email,
          reason: `Not enriched · older than ${STALE_MIN_AGE_DAYS} days`,
        });
      }
    }

    sendResponse(res, 200, "Contacts analysed", {
      duplicateGroups,
      stale,
      analysedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(error, "Error deduping contacts");
    sendResponse(res, 500, "Failed to analyse contacts", null, error.message);
  }
};
