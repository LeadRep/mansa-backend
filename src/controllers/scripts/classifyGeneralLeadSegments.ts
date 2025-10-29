import axios from "axios";
import { Request, Response } from "express";
import { Op } from "sequelize";
import logger from "../../logger";
import { GeneralLeads } from "../../models/GeneralLeads";
import sendResponse from "../../utils/http/sendResponse";

const SEGMENT_OPTIONS: string[] = [
  "Commercial Banking",
  "Retail Banking",
  "Corporate Banking",
  "Investment Banking",
  "Private Banking",
  "Islamic Banking",
  "Online Banking",
  "Central Banking",
  "Microfinance Institutions",
  "Life Insurance",
  "Health Insurance",
  "Property and Casualty Insurance",
  "Reinsurance",
  "Auto Insurance",
  "Travel Insurance",
  "Insurance Brokerage",
  "Actuarial Services",
  "Asset Management",
  "Wealth Management",
  "Mutual Funds",
  "Hedge Funds",
  "Private Equity",
  "Venture Capital",
  "Investment Advisory",
  "Portfolio Management",
  "Financial Planning",
  "Stock Exchanges",
  "Brokerage Firms",
  "Securities Trading",
  "Derivatives Trading",
  "Bond Markets",
  "Commodities Trading",
  "Market Making",
  "Clearing and Settlement Services",
  "Digital Payments",
  "Neobanks",
  "Blockchain and Cryptocurrency",
  "Peer-to-Peer Lending",
  "Robo-Advisors",
  "Crowdfunding Platforms",
  "Buy Now Pay Later (BNPL)",
  "RegTech",
  "InsurTech",
  "Consumer Lending",
  "Commercial Lending",
  "Mortgage Banking",
  "Credit Unions",
  "Credit Card Services",
  "Leasing and Hire Purchase",
  "Factoring and Invoice Financing",
  "Accounting Services",
  "Auditing and Assurance",
  "Tax Consultancy",
  "Bookkeeping",
  "Payroll Management",
  "Financial Analytics",
  "Sovereign Wealth Funds",
  "Treasury Management",
  "Government Financial Services",
  "Development Finance Institutions",
  "Independent Financial Advisor",
  "Financial Advisor",
  "Financial Planner",
  "Certified Financial Planner",
  "Financial Consultant",
  "Pension funds",
  "Church",
  "Foundations",
];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT;

const formatLeadSummary = (lead: any) => {
  const org = lead.organization ?? {};
  const sections: string[] = [];
  sections.push(`Name: ${lead.full_name ?? lead.name ?? "N/A"}`);
  sections.push(`Title: ${lead.title ?? "N/A"}`);
  sections.push(`Departments: ${(lead.departments || []).join(", ") || "N/A"}`);
  sections.push(`Seniority: ${lead.seniority ?? "N/A"}`);
  sections.push(`Functions: ${(lead.functions || []).join(", ") || "N/A"}`);
  sections.push(`Country: ${lead.country ?? org.country ?? "N/A"}`);
  sections.push(`Organization: ${org.name ?? "N/A"}`);
  sections.push(
    `Organization Description: ${
      org.short_description ??
      org.long_description ??
      org.profile_description ??
      "N/A"
    }`
  );
  sections.push(`Organization Industry: ${org.industry ?? org.categories ?? "N/A"}`);
  sections.push(
    `Existing Categories: ${lead.category ?? ""} | ${lead.reason ?? ""}`
  );
  return sections.join("\n");
};

const callSegmentsModel = async (lead: any) => {
  if (!OPENAI_API_KEY || !OPENAI_ENDPOINT) {
    throw new Error("OpenAI credentials are not configured");
  }

  const systemPrompt =
    "You are a B2B classification assistant for financial services. Review the lead information and map them to the best matching segments from the provided list. Return concise JSON only.";

  const prompt = `
Lead details:
${formatLeadSummary(lead)}

Available segments (always choose from this list only):
${SEGMENT_OPTIONS.map((value) => `- ${value}`).join("\n")}

Instructions:
- Respond with valid JSON, no markdown.
- The JSON must have:
  {
    "segments": ["Segment 1", "Segment 2"]
  }
- "segments" must be an array strictly from the list above.
- If uncertain, still choose the closest match.
`;

  const response = await axios.post(
    OPENAI_ENDPOINT,
    {
      model: "gpt-4",
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "api-key": OPENAI_API_KEY,
      },
      timeout: 60000,
    }
  );

  let content: string =
    response?.data?.choices?.[0]?.message?.content?.trim() ?? "";

  content = content
    .replace(/^```(json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(content);
};

const sanitizeArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) =>
            typeof item === "string" ? item.trim() : String(item ?? "").trim()
          )
          .filter((item) => item.length)
      )
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[,;]+/)
          .map((item) => item.trim())
          .filter((item) => item.length)
      )
    );
  }
  return [];
};

export const classifyGeneralLeadSegments = async (
  req: Request,
  res: Response
) => {
  const limitParam =
    typeof req.query.limit === "string"
      ? Number.parseInt(req.params.limit, 10)
      : NaN;
  const limit = Number.isNaN(limitParam) || limitParam < 1 ? 25 : limitParam;

  try {
    const leads = await GeneralLeads.findAll({
      where: {
        [Op.or]: [
          { segments: { [Op.is]: null } },
          { segments: { [Op.eq]: [] } },
        ],
      },
      limit,
      order: [["updatedAt", "ASC"]],
    });

    if (!leads.length) {
      sendResponse(res, 200, "No general leads require classification", {
        processed: 0,
        updated: 0,
        failures: [],
      });
      return;
    }

    const results = [];
    const failures: Array<{ id: string; reason: string }> = [];
    let updated = 0;

    for (const lead of leads) {
      try {
        const aiResult = await callSegmentsModel(lead.get({ plain: true }));
        const segments = sanitizeArray(aiResult?.segments);

        await lead.update({
          segments: segments.length ? segments : null,
        });
        updated += 1;
        results.push({
          id: lead.id,
          segments,
        });
      } catch (error: any) {
        const reason =
          error?.response?.data?.error ??
          error?.message ??
          "Failed to classify lead";
        logger.error(
          { leadId: lead.id, reason },
          "Failed to classify lead segment"
        );
        failures.push({ id: lead.id, reason });
      }
    }

    sendResponse(res, 200, "Lead segments classified", {
      processed: leads.length,
      updated,
      results,
      failures,
    });
  } catch (error: any) {
    logger.error(
      { error: error?.message, stack: error?.stack },
      "Failed to classify lead segments"
    );
    sendResponse(res, 500, "Failed to classify lead segments", null, error?.message);
  }
};
