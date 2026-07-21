/**
 * POST /v1/ai/leads/:leadId/insights
 *
 * "Why this lead?" — returns a short reasoning line plus up to four buying
 * signals inferred from the lead's own data (Apollo org info, our score
 * reason, ICP/BP match). No DB persistence — the frontend caches per session.
 */
import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { Leads } from "../../models/Leads";
import { CustomerPref } from "../../models/CustomerPref";
import { aiService } from "../../utils/http/services/aiService";

export type SignalType =
  | "funding_round"
  | "hiring_spike"
  | "exec_change"
  | "growth"
  | "intent"
  | "news";

export type LeadSignal = {
  type: SignalType;
  label: string;
};

export type LeadInsights = {
  reasoning: string;
  signals: LeadSignal[];
};

const ALLOWED_TYPES: SignalType[] = [
  "funding_round",
  "hiring_spike",
  "exec_change",
  "growth",
  "intent",
  "news",
];

const orgSummary = (org: any) => {
  if (!org || typeof org !== "object") return {};
  return {
    name: org.name || org.company || null,
    industry: org.industry || null,
    country: org.country || null,
    employees: org.estimated_num_employees || null,
    revenue: org.organization_revenue_printed || null,
    hc6mGrowth: org.organization_headcount_six_month_growth || null,
    hc12mGrowth: org.organization_headcount_twelve_month_growth || null,
    intent: org.intent_strength || null,
    keywords: Array.isArray(org.keywords) ? org.keywords.slice(0, 8) : null,
    shortDescription: org.short_description || null,
  };
};

export const leadInsightsHandler = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const leadId = req.params.leadId;

  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  try {
    const lead = await Leads.findOne({ where: { id: leadId, owner_id: userId } });
    if (!lead) {
      sendResponse(res, 404, "Lead not found");
      return;
    }

    const j: any = lead.get({ plain: true });
    const customerPref = await CustomerPref.findOne({ where: { userId } });
    const cp: any = customerPref?.get({ plain: true }) || {};

    const leadPayload = {
      name: j.full_name,
      title: j.title,
      headline: j.headline,
      country: j.country,
      score: j.score,
      category: j.category,
      reason: j.reason,
      company: orgSummary(j.organization),
    };

    const messages = [
      {
        role: "system",
        content:
          "You explain why a B2B sales lead is a good match. You output ONLY a JSON object. " +
          "Be honest: if you have no evidence for a signal, return an empty signals array. Do not invent facts.",
      },
      {
        role: "user",
        content: [
          "Given this seller's ICP and Buyer Persona:",
          `ICP: ${JSON.stringify(cp.ICP || null)}`,
          `BP: ${JSON.stringify(cp.BP || null)}`,
          "",
          "And this lead:",
          JSON.stringify(leadPayload),
          "",
          "Return JSON:",
          "{",
          '  "reasoning": "One sentence explaining the fit, grounded in the lead\'s own data.",',
          '  "signals": [ { "type": "funding_round|hiring_spike|exec_change|growth|intent|news", "label": "short chip label" } ]',
          "}",
          "Rules:",
          "- Max 4 signals. Only include a signal if there is concrete evidence in the input (e.g. positive headcount growth ⇒ hiring_spike; intent_strength high ⇒ intent).",
          "- Keep each label ≤ 6 words.",
          "- Reasoning ≤ 200 characters.",
        ].join("\n"),
      },
    ];

    const response = await aiService.request({
      messages,
      max_tokens: 400,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const parsed = normalizeInsights(response.data);

    sendResponse(res, 200, "Lead insights generated", parsed);
  } catch (error: any) {
    logger.error(error, "Error generating lead insights");
    sendResponse(res, 500, "Failed to generate insights", null, error.message);
  }
};

function normalizeInsights(raw: any): LeadInsights {
  const reasoning =
    typeof raw?.reasoning === "string" ? raw.reasoning.trim().slice(0, 240) : "";
  const rawSignals: any[] = Array.isArray(raw?.signals) ? raw.signals : [];
  const signals: LeadSignal[] = rawSignals
    .map((s) => ({
      type: ALLOWED_TYPES.includes(s?.type) ? (s.type as SignalType) : null,
      label: typeof s?.label === "string" ? s.label.trim().slice(0, 60) : "",
    }))
    .filter((s): s is LeadSignal => !!s.type && !!s.label)
    .slice(0, 4);

  return { reasoning, signals };
}
