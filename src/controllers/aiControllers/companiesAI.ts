/**
 * Companies AI endpoints.
 *
 *   GET /v1/ai/companies/brief/:id     → AI-written brief for one company
 *   GET /v1/ai/companies/similar/:id   → rule-based similar-company list
 *
 * Brief is cached in-memory per company for 24h (same brief for every user who
 * views a given account).  Similar accounts are a cheap SQL query on the
 * Companies table.
 */
import { Request, Response } from "express";
import { Op } from "sequelize";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Companies from "../../models/Companies";
import { aiService } from "../../utils/http/services/aiService";

const BRIEF_TTL_MS = 24 * 60 * 60 * 1000;
const briefCache = new Map<string, { payload: CompanyBrief; expiresAt: number }>();

export type CompanyBrief = {
  summary: string;
  hiring: string | null;
  funding: string | null;
  competitors: string[];
  buyingLikelihood: "low" | "medium" | "high";
  buyingReason: string | null;
  generatedAt: string;
};

/* ============================================================
   Brief
   ============================================================ */

export const companyBriefHandler = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const companyId = req.params.id;
  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  const cached = briefCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    sendResponse(res, 200, "Company brief (cached)", cached.payload);
    return;
  }

  try {
    const company = await Companies.findByPk(companyId);
    if (!company) {
      sendResponse(res, 404, "Company not found");
      return;
    }
    const j: any = company.get({ plain: true });

    // Compact input — send only fields that carry signal.
    const compact = {
      name: j.name,
      industry: j.industry,
      short_description: j.short_description,
      country: j.country,
      city: j.city,
      founded_year: j.founded_year,
      employees: j.estimated_num_employees,
      revenue: j.organization_revenue_printed,
      hc6mGrowth: j.organization_headcount_six_month_growth,
      hc12mGrowth: j.organization_headcount_twelve_month_growth,
      hc24mGrowth: j.organization_headcount_twenty_four_month_growth,
      intent_strength: j.intent_strength,
      keywords: Array.isArray(j.keywords) ? j.keywords.slice(0, 12) : null,
      website: j.website_url || j.primary_domain,
    };

    const messages = [
      {
        role: "system",
        content:
          "You are a sales-intel analyst. Write a concise brief on a target company. " +
          "Output ONLY JSON. Only claim things you can ground in the input — no hallucination.",
      },
      {
        role: "user",
        content: [
          `Company data: ${JSON.stringify(compact)}`,
          "",
          "Return JSON:",
          "{",
          '  "summary": "2 sentences: what they do, who they serve, current state.",',
          '  "hiring": "1 sentence hiring signal or null if unknown",',
          '  "funding": "1 sentence funding/revenue signal or null if unknown",',
          '  "competitors": ["up to 3 likely competitors, inferred from industry/keywords"],',
          '  "buyingLikelihood": "low | medium | high",',
          '  "buyingReason": "1 sentence explaining the likelihood, grounded in the input"',
          "}",
          "Rules: never invent an employee count, funding round, or investor name that isn't in the input.",
        ].join("\n"),
      },
    ];

    const response = await aiService.request({
      messages,
      max_tokens: 500,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const payload = normalizeBrief(response.data);
    briefCache.set(companyId, { payload, expiresAt: Date.now() + BRIEF_TTL_MS });
    sendResponse(res, 200, "Company brief", payload);
  } catch (error: any) {
    logger.error(error, "Error generating company brief");
    sendResponse(res, 500, "Failed to generate brief", null, error.message);
  }
};

function normalizeBrief(raw: any): CompanyBrief {
  const str = (v: any, max = 300): string | null => {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s.length ? s.slice(0, max) : null;
  };
  const arr = (v: any): string[] =>
    Array.isArray(v)
      ? v
          .map((x) => (typeof x === "string" ? x.trim().slice(0, 60) : ""))
          .filter((x) => x.length > 0)
          .slice(0, 3)
      : [];
  const likelihood: CompanyBrief["buyingLikelihood"] =
    raw?.buyingLikelihood === "high" ||
    raw?.buyingLikelihood === "low" ||
    raw?.buyingLikelihood === "medium"
      ? raw.buyingLikelihood
      : "medium";

  return {
    summary: str(raw?.summary, 500) || "No summary available.",
    hiring: str(raw?.hiring),
    funding: str(raw?.funding),
    competitors: arr(raw?.competitors),
    buyingLikelihood: likelihood,
    buyingReason: str(raw?.buyingReason),
    generatedAt: new Date().toISOString(),
  };
}

/* ============================================================
   Similar accounts (rule-based)
   ============================================================ */

export const companySimilarHandler = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const companyId = req.params.id;
  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  try {
    const source = await Companies.findByPk(companyId);
    if (!source) {
      sendResponse(res, 404, "Company not found");
      return;
    }
    const j: any = source.get({ plain: true });

    const where: any = { id: { [Op.ne]: j.id } };
    if (j.industry) where.industry = j.industry;
    if (j.country) where.country = j.country;

    // Employee band ± 60% around the source.
    if (typeof j.estimated_num_employees === "number" && j.estimated_num_employees > 0) {
      const min = Math.max(1, Math.floor(j.estimated_num_employees * 0.4));
      const max = Math.ceil(j.estimated_num_employees * 1.6);
      where.estimated_num_employees = { [Op.between]: [min, max] };
    }

    const candidates = await Companies.findAll({
      where,
      limit: 40,
      order: [["organization_headcount_twelve_month_growth", "DESC NULLS LAST"] as any],
      attributes: [
        "id",
        "name",
        "logo_url",
        "website_url",
        "primary_domain",
        "industry",
        "country",
        "city",
        "estimated_num_employees",
        "organization_revenue_printed",
        "organization_headcount_twelve_month_growth",
        "short_description",
      ],
    });

    // Score & reason per candidate.
    const scored = candidates.map((c) => {
      const cj: any = c.get({ plain: true });
      const reasons: string[] = [];
      if (cj.industry === j.industry) reasons.push(`Same industry (${cj.industry})`);
      if (cj.country === j.country) reasons.push(`Same country`);
      if (
        typeof cj.estimated_num_employees === "number" &&
        typeof j.estimated_num_employees === "number"
      ) {
        const delta = Math.abs(cj.estimated_num_employees - j.estimated_num_employees);
        const pct = delta / Math.max(j.estimated_num_employees, 1);
        if (pct <= 0.3) reasons.push("Similar headcount");
      }
      if (
        typeof cj.organization_headcount_twelve_month_growth === "number" &&
        cj.organization_headcount_twelve_month_growth > 0.05
      ) {
        reasons.push(
          `Growing team (+${Math.round(cj.organization_headcount_twelve_month_growth * 100)}% / 12m)`
        );
      }
      return {
        id: cj.id,
        name: cj.name,
        logo_url: cj.logo_url,
        website_url: cj.website_url || cj.primary_domain,
        industry: cj.industry,
        country: cj.country,
        city: cj.city,
        employees: cj.estimated_num_employees,
        revenue: cj.organization_revenue_printed,
        reasons,
        score: reasons.length,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 10);

    sendResponse(res, 200, "Similar companies", { companies: top });
  } catch (error: any) {
    logger.error(error, "Error finding similar companies");
    sendResponse(res, 500, "Failed to find similar companies", null, error.message);
  }
};
