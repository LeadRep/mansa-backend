import {Request, Response} from "express";
import {Op, WhereOptions} from "sequelize";
import sendResponse from "../../utils/http/sendResponse";
import {
    ACILeads,
    ACILeadsAttributes,
} from "../../models/ACILeads";
import logger from "../../logger";
import {normalizeLead, PlainLead} from "./utils";
import Users from "../../models/Users";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

const TAG_LABEL_TO_COLUMN: Record<string, keyof ACILeadsAttributes> = {
    "etf": "is_etf",
    "fixed income": "is_fixed_income",
    "equities": "is_equities",
};

const ALLOCATION_FOCUS_LABEL_TO_COLUMN: Record<string, keyof ACILeadsAttributes> = {
    "etf": "is_lead_etf",
    "fixed income": "is_lead_fixed_income",
    "equities": "is_lead_equities",
    "alternatives": "is_lead_alternatives",
    "multi-asset": "is_lead_multi_asset",
    "digital assets": "is_lead_digital_assets",
};

const buildBooleanFlagConditions = (
    rawLabels: unknown[],
    mapping: Record<string, keyof ACILeadsAttributes>
): any[] => {
    const conditions: any[] = [];

    for (const raw of rawLabels) {
        const normalized = String(raw).toLowerCase().trim();
        const column = mapping[normalized];
        if (column) {
            conditions.push({[column]: true});
        }
    }

    return conditions;
};
const MAX_LIMIT = 200;


const parseListParam = (value: unknown): string[] => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => Boolean(item));
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => (typeof item === "string" ? item.trim() : ""))
                    .filter((item) => Boolean(item));
            }
        } catch (error) {
            // ignore JSON parse error, fallback to comma split
        }

        return trimmed
            .split(",")
            .map((item) => item.trim())
            .filter((item) => Boolean(item));
    }

    return [];
};

const buildFilters = (
    search: string,
    titles: string[],
    countries: string[],
    segments: string[],
    allocationFocus: string[],
    tags: string[],
    lock: string | null,
    organizationId: string
): WhereOptions<ACILeadsAttributes> => {
    const andConditions: any[] = [];

    if (search) {
        const likeValue = `%${search}%`;
        andConditions.push({
            [Op.or]: [
                {name: {[Op.iLike]: likeValue}},
                {full_name: {[Op.iLike]: likeValue}},
                {title: {[Op.iLike]: likeValue}},
                {email: {[Op.iLike]: likeValue}},
                {country: {[Op.iLike]: likeValue}},
            ],
        });
    }

    if (titles.length) {
      andConditions.push({
        [Op.or]: titles.map((title) => (
          (ACILeads.sequelize as any).literal(`COALESCE(normalized_title, title) ILIKE '%${title.replace(/'/g, "''")}%'`)
        )),
      });
    }

  if (countries.length) {
        const normalizedCountries = countries.map((country) =>
            country.toLowerCase()
        );
        andConditions.push({
            [Op.or]: [
                {
                    country: {
                        [Op.in]: countries,
                    },
                },
                {
                    country: {
                        [Op.in]: normalizedCountries,
                    },
                },
            ],
        });
    }

  // lock can be "locked", "unlocked" or null
  if (lock) {
    // If we have an organization context, check LeadExports for organization-scoped exports.
    // Use a literal EXISTS subquery for fast indexed lookups.
    const escOrg = (ACILeads.sequelize as any).escape(organizationId);
    const existsSql = `EXISTS (
                SELECT 1 FROM "LeadExports" le
                WHERE le.lead_id = "aci_leads".id
                  AND le.exported_for_organization_id = ${escOrg}
            )`;

    if (lock === "locked") {
      // not exported for the organization
      andConditions.push((ACILeads.sequelize as any).literal(`NOT ${existsSql}`));
    } else if (lock === "unlocked") {
      // exported for the organization
      andConditions.push((ACILeads.sequelize as any).literal(existsSql));
    }
  }

    if (tags.length) {
        const tagConditions = buildBooleanFlagConditions(tags, TAG_LABEL_TO_COLUMN);

        if (tagConditions.length) {
            andConditions.push({
                [Op.or]: tagConditions,
            });
        }
    }

    if (allocationFocus.length) {
        const allocationFocusConditions = buildBooleanFlagConditions(
            allocationFocus,
            ALLOCATION_FOCUS_LABEL_TO_COLUMN
        );


        if (allocationFocusConditions.length) {
            andConditions.push({
                [Op.or]: allocationFocusConditions,
            });
        }
    }


    if (segments.length) {
        andConditions.push({
            segments: {[Op.overlap]: segments},
        });
    }

    if (!andConditions.length) {
        return {};
    }

    if (andConditions.length === 1) {
        return andConditions[0];
    }

    return {
        [Op.and]: andConditions,
    };
};

export const getAciLeads = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const user = await Users.findOne({ where: { id: userId } });
      if(!user) {
        sendResponse(res, 401, "User not found");
        return;
      }

      const pageParam =
        typeof req.query.page === "string"
          ? Number.parseInt(req.query.page, 10)
          : NaN;
      const limitParam =
        typeof req.query.limit === "string"
          ? Number.parseInt(req.query.limit, 10)
          : NaN;

        const page =
            Number.isNaN(pageParam) || pageParam < 1 ? DEFAULT_PAGE : pageParam;
        const limitCandidate =
            Number.isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam;
        const limit = Math.min(limitCandidate, MAX_LIMIT);
        const offset = (page - 1) * limit;

        const search =
            typeof req.query.search === "string" ? req.query.search.trim() : "";
        const titles = parseListParam(req.query.titles);
        const countries = parseListParam(req.query.countries);
        const segments = parseListParam(req.query.segments);
        const lock = typeof req.query.lock === "string" ? req.query.lock.trim() : null;
        const tags = parseListParam(req.query.tags);
        const allocationFocus = parseListParam(req.query.allocationFocus);


    const where = buildFilters(search, titles, countries, segments, allocationFocus, tags, lock, user.organization_id);

        const {rows, count} = await ACILeads.findAndCountAll({
            where,
            limit,
            offset,
            order: [["priority", "DESC"], ["createdAt", "DESC"]],
          attributes: {
            include: [
              [
                (ACILeads.sequelize as any).literal(`
                            EXISTS (
                                SELECT 1 FROM "LeadExports" le
                                WHERE le.lead_id = "aci_leads".id
                                  AND le.exported_for_organization_id = ${(ACILeads.sequelize as any).escape(user.organization_id)}
                            )
                        `),
                'exportedForOrganization'
              ]
            ]
          }

        });

        const leads = rows.map((lead) =>
            normalizeLead(lead.get({plain: true}) as PlainLead)
        );

        const totalPages = limit ? Math.ceil(count / limit) : 1;

        sendResponse(res, 200, "ACI leads fetched successfully", {
            data: leads,
            pagination: {
                page,
                limit,
                total: count,
                totalPages,
            },
            filtersApplied: {
                search: search || null,
                titles,
                countries,
            },
        });
    } catch (error: any) {
        logger.error(
            {
                error: error?.message,
                stack: error?.stack,
            },
            "Failed to fetch ACI leads"
        );
        sendResponse(res, 500, "Failed to fetch ACI leads", null, error?.message);
    }
};
