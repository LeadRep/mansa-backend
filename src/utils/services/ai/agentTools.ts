/**
 * Tool definitions and executors for the /ai/ask agent.
 *
 * Every tool is scoped to the caller's userId — the model cannot bypass
 * that filter. Row limits are enforced server-side.
 */
import { Op } from "sequelize";
import { database } from "../../../configs/database/database";
import { Leads } from "../../../models/Leads";
import Deals from "../../../models/Deals";
import { DealContact } from "../../../models/DealContacts";
import { DealContactNote } from "../../../models/DealContactNotes";
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
    "List the current user's leads. Optionally search by query keyword " +
    "(matching lead name, email, or company name), or filter by status " +
    "(new/saved/viewed/reserve/deleted), category, minimum score, or country. " +
    "Ordered by score descending, then most recent.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search by lead name, company name, or email" },
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

    if (args.query && typeof args.query === "string" && args.query.trim()) {
      const q = `%${args.query.trim()}%`;
      where[Op.or] = [
        { full_name: { [Op.iLike]: q } },
        { email: { [Op.iLike]: q } },
        database.where(database.cast(database.col("organization"), "text"), { [Op.iLike]: q }),
      ];
    }

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
    "List contacts and deals inside the user's deal pipelines. " +
    "Supports searching by query (lead/contact name, company name, or email), " +
    "or filtering by dealId or stageId. Returns stage name, deal value, " +
    "and recent notes/comments added in the pipeline.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search by lead name, company name, or email" },
      dealId: { type: "string" },
      stageId: { type: "string" },
      includeNotes: { type: "boolean", description: "Whether to include notes (default true)" },
      limit: { type: "number", description: "Max rows, default 10, max 25" },
    },
  },
  run: async (args, ctx) => {
    const where: any = { owner_id: ctx.userId };
    if (args.dealId) where.deal_id = args.dealId;
    if (args.stageId) where.stage_id = args.stageId;

    if (args.query && typeof args.query === "string" && args.query.trim()) {
      const q = `%${args.query.trim()}%`;
      where[Op.or] = [
        { full_name: { [Op.iLike]: q } },
        { email: { [Op.iLike]: q } },
        database.where(database.cast(database.col("organization"), "text"), { [Op.iLike]: q }),
      ];
    }

    const rows = await DealContact.findAll({
      where,
      order: [["deal_value", "DESC"], ["updatedAt", "DESC"]],
      limit: clampLimit(args.limit),
    });

    if (!rows.length) return [];

    // Map stages to human names
    const deals = await Deals.findAll({ where: { userId: ctx.userId } });
    const stageMap = new Map<string, string>();
    for (const d of deals) {
      const j = (d as any).toJSON();
      for (const s of (j.stages || [])) {
        if (s.id) stageMap.set(s.id, s.name || "Unnamed Stage");
      }
    }

    // Fetch notes for returned contacts unless explicitly disabled
    const notesByContact = new Map<string, any[]>();
    if (args.includeNotes !== false) {
      const contactIds = rows.map((r: any) => r.id);
      const notes = await DealContactNote.findAll({
        where: { deal_contact_id: { [Op.in]: contactIds }, owner_id: ctx.userId },
        order: [["createdAt", "DESC"]],
      });
      for (const n of notes) {
        const nj = (n as any).toJSON();
        const list = notesByContact.get(nj.deal_contact_id) || [];
        list.push({
          id: nj.id,
          comment: nj.comment,
          fileName: nj.file_name,
          createdAt: nj.createdAt,
        });
        notesByContact.set(nj.deal_contact_id, list);
      }
    }

    return rows.map((r) => {
      const j: any = r.toJSON();
      const contactNotes = notesByContact.get(j.id) || [];
      return {
        id: j.id,
        dealId: j.deal_id,
        stageId: j.stage_id,
        stageName: stageMap.get(j.stage_id) || "Unknown Stage",
        name: j.full_name,
        title: j.title,
        company: orgName(j.organization),
        email: j.email,
        phone: j.phone,
        country: j.country,
        score: j.score,
        deal_value: j.deal_value,
        notesCount: contactNotes.length,
        notes: contactNotes.slice(0, 5),
        latestNote: contactNotes[0]?.comment || null,
        updatedAt: j.updatedAt,
      };
    });
  },
};

const getDealNotes: ToolSpec = {
  name: "get_deal_notes",
  description:
    "Retrieve the complete notes, comments, call logs, and latest status for a deal in the pipeline. " +
    "Provide either a contactId (UUID of the deal contact) or a search query (company name, lead name, or email). " +
    "Returns current stage name, deal value, and full chronological notes.",
  parameters: {
    type: "object",
    properties: {
      contactId: { type: "string", description: "The UUID of the deal contact" },
      query: { type: "string", description: "Search term: company name, lead name, or email" },
      limit: { type: "number", description: "Max notes to return, default 20" },
    },
  },
  run: async (args, ctx) => {
    let contacts: DealContact[] = [];

    if (args.contactId) {
      const c = await DealContact.findOne({
        where: { id: args.contactId, owner_id: ctx.userId },
      });
      if (c) contacts = [c];
    } else if (args.query && typeof args.query === "string" && args.query.trim()) {
      const q = `%${args.query.trim()}%`;
      contacts = await DealContact.findAll({
        where: {
          owner_id: ctx.userId,
          [Op.or]: [
            { full_name: { [Op.iLike]: q } },
            { email: { [Op.iLike]: q } },
            database.where(database.cast(database.col("organization"), "text"), { [Op.iLike]: q }),
          ],
        },
        order: [["deal_value", "DESC"], ["updatedAt", "DESC"]],
        limit: 10,
      });

      // If no direct contact match, check if any deal note text matches the query!
      if (!contacts.length) {
        const matchingNotes = await DealContactNote.findAll({
          where: {
            owner_id: ctx.userId,
            comment: { [Op.iLike]: q },
          },
          attributes: ["deal_contact_id"],
          limit: 10,
        });
        const matchedIds = matchingNotes.map((n: any) => n.deal_contact_id);
        if (matchedIds.length) {
          contacts = await DealContact.findAll({
            where: {
              id: { [Op.in]: matchedIds },
              owner_id: ctx.userId,
            },
          });
        }
      }
    } else {
      contacts = await DealContact.findAll({
        where: { owner_id: ctx.userId },
        order: [["updatedAt", "DESC"]],
        limit: 5,
      });
    }

    if (!contacts.length) {
      return { found: false, message: "No matching deal contacts found." };
    }

    // Map stages
    const deals = await Deals.findAll({ where: { userId: ctx.userId } });
    const stageMap = new Map<string, string>();
    for (const d of deals) {
      const j = (d as any).toJSON();
      for (const s of (j.stages || [])) {
        if (s.id) stageMap.set(s.id, s.name || "Unnamed Stage");
      }
    }

    const contactIds = contacts.map((c: any) => c.id);
    const notes = await DealContactNote.findAll({
      where: { deal_contact_id: { [Op.in]: contactIds }, owner_id: ctx.userId },
      order: [["createdAt", "DESC"]],
      limit: clampLimit(args.limit || 20),
    });

    const notesByContact = new Map<string, any[]>();
    for (const n of notes) {
      const nj = (n as any).toJSON();
      const list = notesByContact.get(nj.deal_contact_id) || [];
      list.push({
        id: nj.id,
        comment: nj.comment,
        fileName: nj.file_name,
        fileUrl: nj.file_url,
        createdAt: nj.createdAt,
      });
      notesByContact.set(nj.deal_contact_id, list);
    }

    const results = contacts.map((c) => {
      const cj: any = c.toJSON();
      const cNotes = notesByContact.get(cj.id) || [];
      return {
        contactId: cj.id,
        name: cj.full_name,
        title: cj.title,
        company: orgName(cj.organization),
        email: cj.email,
        phone: cj.phone,
        dealValue: cj.deal_value,
        stageId: cj.stage_id,
        stageName: stageMap.get(cj.stage_id) || "Unknown Stage",
        notesCount: cNotes.length,
        notes: cNotes,
        updatedAt: cj.updatedAt,
      };
    });

    return {
      found: true,
      deals: results,
    };
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
      .sort((a, b) => (b.leadCount + b.contactCount) - (a.leadCount + a.contactCount))
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
  getDealNotes,
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
