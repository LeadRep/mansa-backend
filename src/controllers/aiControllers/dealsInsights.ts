/**
 * Deals AI endpoints.
 *
 *   POST /v1/ai/deals/:contactId/action   → { action, reason }
 *   GET  /v1/ai/deals/digest              → { summary, highlights[], risks[], generatedAt }
 *
 * Digest is per-user in-memory cached for 60 minutes so a page refresh is free.
 * Next-best-action is computed on demand; the frontend session-caches responses.
 */
import { Request, Response } from "express";
import { Op } from "sequelize";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Deals from "../../models/Deals";
import { DealContact } from "../../models/DealContacts";
import { aiService } from "../../utils/http/services/aiService";

const DIGEST_TTL_MS = 60 * 60 * 1000;
const digestCache = new Map<string, { payload: PipelineDigest; expiresAt: number }>();

export type NextAction = {
  action: string;
  reason: string;
  urgency: "low" | "medium" | "high";
};

export type PipelineDigest = {
  summary: string;
  highlights: string[];
  risks: string[];
  metrics: {
    openDeals: number;
    totalValue: number;
    weightedValue: number;
    stuckCount: number;
    movedLast7d: number;
  };
  generatedAt: string;
};

const daysSince = (d: Date | string | null | undefined): number => {
  if (!d) return 0;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
};

const orgName = (org: any): string | null => {
  if (!org || typeof org !== "object") return null;
  return org.name || org.company || org.legal_name || null;
};

/* ============================================================
   Next-best-action
   ============================================================ */

export const dealNextActionHandler = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const contactId = req.params.contactId;
  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  try {
    const contact = await DealContact.findOne({
      where: { id: contactId, owner_id: userId },
    });
    if (!contact) {
      sendResponse(res, 404, "Deal contact not found");
      return;
    }
    const j: any = contact.get({ plain: true });

    // Resolve the stage name from the parent Deal's stages JSON.
    const deal = await Deals.findOne({ where: { id: j.deal_id, userId } });
    const stages: any[] = (deal as any)?.stages || [];
    const stage = stages.find((s: any) => s.id === j.stage_id);
    const stageName: string = stage?.name || "unknown";
    const stageProbability: number | null = stage?.probability ?? null;

    const daysInStage = daysSince(j.updatedAt);
    const summary = {
      name: j.full_name,
      title: j.title,
      company: orgName(j.organization),
      email: j.email || null,
      score: j.score ?? null,
      dealValue: j.deal_value ?? 0,
      stage: stageName,
      stageProbability,
      daysSinceUpdate: daysInStage,
    };

    const messages = [
      {
        role: "system",
        content:
          "You are a sales coach. Given one deal, propose the single next best action a rep should take today. Output ONLY JSON.",
      },
      {
        role: "user",
        content: [
          "Deal:",
          JSON.stringify(summary),
          "",
          "Return JSON:",
          "{",
          '  "action": "≤ 8 words, imperative verb first (e.g. \\"Send a follow-up email\\", \\"Book a discovery call\\")",',
          '  "reason": "One short sentence explaining why, grounded in the deal fields.",',
          '  "urgency": "low | medium | high"',
          "}",
          "Guidance: bias toward concrete actions the rep can do in 5 minutes. If daysSinceUpdate > 10 escalate urgency.",
        ].join("\n"),
      },
    ];

    const response = await aiService.request({
      messages,
      max_tokens: 250,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    sendResponse(res, 200, "Next best action generated", normalizeAction(response.data));
  } catch (error: any) {
    logger.error(error, "Error generating next-best-action");
    sendResponse(res, 500, "Failed to generate next action", null, error.message);
  }
};

function normalizeAction(raw: any): NextAction {
  const action = typeof raw?.action === "string" ? raw.action.trim().slice(0, 80) : "";
  const reason = typeof raw?.reason === "string" ? raw.reason.trim().slice(0, 240) : "";
  const urgency: NextAction["urgency"] =
    raw?.urgency === "high" || raw?.urgency === "medium" || raw?.urgency === "low"
      ? raw.urgency
      : "medium";
  return { action: action || "Send a follow-up email", reason, urgency };
}

/* ============================================================
   Weekly pipeline digest
   ============================================================ */

export const pipelineDigestHandler = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  const cached = digestCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    sendResponse(res, 200, "Pipeline digest (cached)", cached.payload);
    return;
  }

  try {
    const deals = await Deals.findAll({ where: { userId } });
    const dealIds = deals.map((d: any) => d.id);
    const contacts = dealIds.length
      ? await DealContact.findAll({
          where: { deal_id: { [Op.in]: dealIds }, owner_id: userId },
        })
      : [];

    // Build a small model-friendly summary. Never send raw PII beyond names.
    const stageMap = new Map<string, { name: string; probability: number }>();
    for (const d of deals as any[]) {
      for (const s of d.stages || []) {
        stageMap.set(s.id, { name: s.name, probability: s.probability ?? 0 });
      }
    }

    let totalValue = 0;
    let weightedValue = 0;
    let stuckCount = 0;
    let movedLast7d = 0;
    const stuck: any[] = [];
    const movers: any[] = [];

    for (const c of contacts as any[]) {
      const j = c.toJSON();
      const stage = stageMap.get(j.stage_id);
      const days = daysSince(j.updatedAt);
      const value = j.deal_value || 0;
      const prob = stage?.probability ?? 0;
      totalValue += value;
      weightedValue += (value * prob) / 100;

      const compact = {
        name: j.full_name,
        company: orgName(j.organization),
        stage: stage?.name || "unknown",
        value,
        daysSinceUpdate: days,
      };
      if (days >= 14) {
        stuckCount++;
        stuck.push(compact);
      }
      if (days <= 7) {
        movedLast7d++;
        movers.push(compact);
      }
    }

    stuck.sort((a, b) => b.value - a.value);
    movers.sort((a, b) => b.value - a.value);

    const metrics = {
      openDeals: contacts.length,
      totalValue: Math.round(totalValue),
      weightedValue: Math.round(weightedValue),
      stuckCount,
      movedLast7d,
    };

    // If pipeline is empty, skip the LLM entirely.
    if (contacts.length === 0) {
      const empty: PipelineDigest = {
        summary: "You don't have any deals in your pipeline yet — add contacts to a deal to get started.",
        highlights: [],
        risks: [],
        metrics,
        generatedAt: new Date().toISOString(),
      };
      digestCache.set(userId, { payload: empty, expiresAt: Date.now() + DIGEST_TTL_MS });
      sendResponse(res, 200, "Pipeline digest", empty);
      return;
    }

    const messages = [
      {
        role: "system",
        content:
          "You are a friendly, concise sales manager. Summarise a rep's weekly pipeline. Output ONLY JSON. Ground every claim in the metrics and lists provided — no invented deals.",
      },
      {
        role: "user",
        content: [
          `Metrics: ${JSON.stringify(metrics)}`,
          `Stuck (>14d idle, up to 5): ${JSON.stringify(stuck.slice(0, 5))}`,
          `Recent movers (updated last 7d, up to 5): ${JSON.stringify(movers.slice(0, 5))}`,
          "",
          "Return JSON:",
          "{",
          '  "summary": "2 short sentences, warm tone, mention overall state of the week.",',
          '  "highlights": ["1-line each; ≤3 items; wins or promising movement"],',
          '  "risks": ["1-line each; ≤3 items; deals at risk with specific names"]',
          "}",
          "Rules: never invent names. If no stuck deals, return empty risks. Keep every line ≤ 100 chars.",
        ].join("\n"),
      },
    ];

    const response = await aiService.request({
      messages,
      max_tokens: 500,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const payload = normalizeDigest(response.data, metrics);
    digestCache.set(userId, { payload, expiresAt: Date.now() + DIGEST_TTL_MS });
    sendResponse(res, 200, "Pipeline digest", payload);
  } catch (error: any) {
    logger.error(error, "Error generating pipeline digest");
    sendResponse(res, 500, "Failed to generate digest", null, error.message);
  }
};

function normalizeDigest(
  raw: any,
  metrics: PipelineDigest["metrics"]
): PipelineDigest {
  const summary =
    typeof raw?.summary === "string" ? raw.summary.trim().slice(0, 400) : "";
  const arr = (x: any): string[] =>
    Array.isArray(x)
      ? x
          .map((v) => (typeof v === "string" ? v.trim().slice(0, 140) : ""))
          .filter((v) => v.length > 0)
          .slice(0, 3)
      : [];
  return {
    summary: summary || "Here is your pipeline snapshot.",
    highlights: arr(raw?.highlights),
    risks: arr(raw?.risks),
    metrics,
    generatedAt: new Date().toISOString(),
  };
}
