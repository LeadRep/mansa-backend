/**
 * Tool definitions and executors for the /ai/ask agent.
 *
 * Every tool is scoped to the caller's userId — the model cannot bypass
 * that filter. Row limits are enforced server-side.
 */
import { Op } from "sequelize";
import { Leads } from "../../../models/Leads";
import Deals from "../../../models/Deals";
import { DealContact } from "../../../models/DealContacts";
import Contacts from "../../../models/Contacts";

const MAX_ROWS = 25;

export type ToolContext = { userId: string };

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, any>;
  run: (args: any, ctx: ToolContext) => Promise<any>;
};

const clampLimit = (n: unknown): number => {
  const v = typeof n === "number" ? Math.floor(n) : parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v) || v <= 0) return 10;
  return Math.min(v, MAX_ROWS);
};

const orgName = (org: any): string | null => {
  if (!org || typeof org !== "object") return null;
  return org.name || org.company || org.legal_name || null;
};

/* ---------- Leads ---------- */

const listLeads: ToolSpec = {
  name: "list_leads",
  description:
    "List the current user's leads. Optionally filter by status " +
    "(new/saved/viewed/reserve/deleted), category, minimum score, or country. " +
    "Ordered by score descending, then most recent.",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["new", "saved", "viewed", "reserve", "deleted"] },
      category: { type: "string" },
      minScore: { type: "number", description: "Minimum lead score, 0–100" },
      country: { type: "string" },
      limit: { type: "number", description: "Max rows, default 10, max 25" },
    },
  },
  run: async (args, ctx) => {
    const where: any = { owner_id: ctx.userId };
    if (args.status) where.status = args.status;
    if (args.category) where.category = args.category;
    if (typeof args.minScore === "number") where.score = { [Op.gte]: args.minScore };
    if (args.country) where.country = args.country;

    const rows = await Leads.findAll({
      where,
      order: [
        ["score", "DESC NULLS LAST"] as any,
        ["updatedAt", "DESC"],
      ],
      limit: clampLimit(args.limit),
    });

    return rows.map((r) => {
      const j: any = r.toJSON();
      return {
        id: j.id,
        name: j.full_name,
        title: j.title,
        company: orgName(j.organization),
        email: j.email,
        country: j.country,
        score: j.score,
        category: j.category,
        reason: j.reason,
        status: j.status,
        updatedAt: j.updatedAt,
      };
    });
  },
};

const countLeads: ToolSpec = {
  name: "count_leads",
  description:
    "Return counts of the user's leads, broken down by status. " +
    "Use before listing to know if there is data at all.",
  parameters: { type: "object", properties: {} },
  run: async (_args, ctx) => {
    const rows = await Leads.findAll({
      where: { owner_id: ctx.userId },
      attributes: ["status"],
      raw: true,
    });
    const total = rows.length;
    const byStatus: Record<string, number> = {};
    for (const r of rows as any[]) {
      const s = r.status || "unknown";
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    return { total, byStatus };
  },
};

const getLeadById: ToolSpec = {
  name: "get_lead_by_id",
  description: "Fetch a single lead owned by the user by its UUID.",
  parameters: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  run: async (args, ctx) => {
    const row = await Leads.findOne({
      where: { id: args.id, owner_id: ctx.userId },
    });
    if (!row) return { found: false };
    const j: any = row.toJSON();
    return {
      found: true,
      id: j.id,
      name: j.full_name,
      title: j.title,
      company: orgName(j.organization),
      email: j.email,
      phone: j.phone,
      linkedin_url: j.linkedin_url,
      country: j.country,
      score: j.score,
      category: j.category,
      reason: j.reason,
      status: j.status,
    };
  },
};

/* ---------- Deals ---------- */

const listDeals: ToolSpec = {
  name: "list_deals",
  description:
    "Return the user's deal pipelines with each stage's name, colour and count " +
    "of contacts sitting in that stage, plus the total deal value per stage.",
  parameters: { type: "object", properties: {} },
  run: async (_args, ctx) => {
    const deals = await Deals.findAll({ where: { userId: ctx.userId } });
    const dealIds = deals.map((d: any) => d.id);
    const contacts = dealIds.length
      ? await DealContact.findAll({
          where: { deal_id: { [Op.in]: dealIds }, owner_id: ctx.userId },
          attributes: ["deal_id", "stage_id", "deal_value"],
          raw: true,
        })
      : [];

    return deals.map((d: any) => {
      const j = d.toJSON();
      const stages = (j.stages || []).map((s: any) => {
        const inStage = (contacts as any[]).filter(
          (c) => c.deal_id === j.id && c.stage_id === s.id
        );
        const value = inStage.reduce((sum, c) => sum + (c.deal_value || 0), 0);
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          probability: s.probability ?? null,
          contactCount: inStage.length,
          totalValue: value,
        };
      });
      return { id: j.id, stages };
    });
  },
};

const listDealContacts: ToolSpec = {
  name: "list_deal_contacts",
  description:
    "List contacts inside the user's deal pipelines. Optionally filter by " +
    "dealId or stageId. Ordered by deal_value desc.",
  parameters: {
    type: "object",
    properties: {
      dealId: { type: "string" },
      stageId: { type: "string" },
      limit: { type: "number", description: "Max rows, default 10, max 25" },
    },
  },
  run: async (args, ctx) => {
    const where: any = { owner_id: ctx.userId };
    if (args.dealId) where.deal_id = args.dealId;
    if (args.stageId) where.stage_id = args.stageId;

    const rows = await DealContact.findAll({
      where,
      order: [["deal_value", "DESC"]],
      limit: clampLimit(args.limit),
    });

    return rows.map((r) => {
      const j: any = r.toJSON();
      return {
        id: j.id,
        dealId: j.deal_id,
        stageId: j.stage_id,
        name: j.full_name,
        title: j.title,
        company: orgName(j.organization),
        email: j.email,
        country: j.country,
        score: j.score,
        deal_value: j.deal_value,
        updatedAt: j.updatedAt,
      };
    });
  },
};

/* ---------- Companies (aggregated from leads + deals) ---------- */

const getCompanies: ToolSpec = {
  name: "get_companies",
  description:
    "List unique companies from the user's leads and deal contacts. " +
    "Returns company name, domain (if available), lead count, and deal contact count. " +
    "Ordered by total engagement (leads + contacts) descending.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max rows, default 10, max 25" },
    },
  },
  run: async (args, ctx) => {
    // Get companies from leads
    const leads = await Leads.findAll({
      where: { owner_id: ctx.userId },
      attributes: ["organization"],
      raw: true,
    });

    // Get companies from deal contacts
    const dealContacts = await DealContact.findAll({
      where: { owner_id: ctx.userId },
      attributes: ["organization"],
      raw: true,
    });

    // Aggregate company data
    const companyMap = new Map<string, { name: string; domain: string | null; leadCount: number; contactCount: number }>();

    const processOrg = (org: any, type: "lead" | "contact") => {
      if (!org || typeof org !== "object") return;
      const name = org.name || org.company || org.legal_name;
      if (!name) return;
      const domain = org.domain || null;

      const existing = companyMap.get(name) || { name, domain, leadCount: 0, contactCount: 0 };
      if (type === "lead") existing.leadCount++;
      else existing.contactCount++;
      companyMap.set(name, existing);
    };

    for (const lead of leads as any[]) {
      processOrg(lead.organization, "lead");
    }
    for (const contact of dealContacts as any[]) {
      processOrg(contact.organization, "contact");
    }

    const companies = Array.from(companyMap.values())
      .sort((a, b) => (b.leadCount + b.contactCount) - (a.leadCount + a.leadCount))
      .slice(0, clampLimit(args.limit));

    return companies;
  },
};

/* ---------- Aggregate Stats ---------- */

const aggregateStats: ToolSpec = {
  name: "aggregate_stats",
  description:
    "Return high-level summary statistics for the user's account: " +
    "total leads (by status), total contacts, total deals/pipelines, " +
    "total pipeline value, and average lead score.",
  parameters: { type: "object", properties: {} },
  run: async (_args, ctx) => {
    // Leads stats
    const leads = await Leads.findAll({
      where: { owner_id: ctx.userId },
      attributes: ["status", "score"],
      raw: true,
    }) as any[];
    const leadsByStatus: Record<string, number> = {};
    let totalLeadScore = 0;
    let scoredLeads = 0;
    for (const lead of leads) {
      const status = lead.status || "unknown";
      leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
      if (typeof lead.score === "number") {
        totalLeadScore += lead.score;
        scoredLeads++;
      }
    }

    // Contacts stats
    const contactsCount = await Contacts.count({ where: { user_id: ctx.userId } });

    // Deals stats
    const deals = await Deals.findAll({
      where: { userId: ctx.userId },
      attributes: ["id"],
      raw: true,
    });
    const dealIds = deals.map((d: any) => d.id);

    // Pipeline value from deal contacts
    let totalPipelineValue = 0;
    if (dealIds.length > 0) {
      const dealContactsAgg = await DealContact.findAll({
        where: { deal_id: { [Op.in]: dealIds }, owner_id: ctx.userId },
        attributes: ["deal_value"],
        raw: true,
      }) as any[];
      totalPipelineValue = dealContactsAgg.reduce((sum, c) => sum + (c.deal_value || 0), 0);
    }

    return {
      leads: {
        total: leads.length,
        byStatus: leadsByStatus,
        avgScore: scoredLeads > 0 ? Math.round(totalLeadScore / scoredLeads) : null,
      },
      contacts: {
        total: contactsCount,
      },
      deals: {
        total: deals.length,
        pipelineValue: totalPipelineValue,
      },
    };
  },
};

/* ---------- Contacts (imported) ---------- */

const listContacts: ToolSpec = {
  name: "list_contacts",
  description:
    "List the user's imported contacts (from Gmail/Outlook sync or CSV). " +
    "Optionally filter by completion / enrichment state.",
  parameters: {
    type: "object",
    properties: {
      isComplete: { type: "boolean" },
      isEnriched: { type: "boolean" },
      validationRequired: { type: "boolean" },
      limit: { type: "number", description: "Max rows, default 10, max 25" },
    },
  },
  run: async (args, ctx) => {
    const where: any = { user_id: ctx.userId };
    if (typeof args.isComplete === "boolean") where.is_complete = args.isComplete;
    if (typeof args.isEnriched === "boolean") where.is_enriched = args.isEnriched;
    if (typeof args.validationRequired === "boolean")
      where.validation_required = args.validationRequired;

    const rows = await Contacts.findAll({
      where,
      order: [["updatedAt", "DESC"]],
      limit: clampLimit(args.limit),
    });

    return rows.map((r) => {
      const j: any = r.toJSON();
      return {
        id: j.contact_id,
        name: j.full_name,
        email: j.email,
        phone: j.phone,
        is_complete: j.is_complete,
        is_enriched: j.is_enriched,
        validation_required: j.validation_required,
      };
    });
  },
};

/* ---------- exports ---------- */

export const TOOLS: ToolSpec[] = [
  countLeads,
  listLeads,
  getLeadById,
  listDeals,
  listDealContacts,
  listContacts,
  getCompanies,
  aggregateStats,
];

export const TOOL_MAP: Record<string, ToolSpec> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t])
);

/** JSON schema definitions sent to the model. */
export const openAiToolDefs = TOOLS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));
