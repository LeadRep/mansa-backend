import { Request, Response } from "express";
import { Op, WhereOptions } from "sequelize";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";
import {
  GeneralLeads,
  GeneralLeadsAttributes,
} from "../../models/GeneralLeads";

type PlainLead = GeneralLeadsAttributes & {
  organization?: any;
  createdAt?: Date;
  updatedAt?: Date;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
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
      // ignore JSON parse error, fall back to comma split
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter((item) => Boolean(item));
  }

  return [];
};

const coerceOrganization = (value: unknown): Record<string, any> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value as Record<string, any>;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.warn(
        { error: (error as Error)?.message },
        "Unable to parse organization payload for ACI lead"
      );
      return null;
    }
  }

  return null;
};

const normalizeLead = (lead: PlainLead) => {
  const organization = coerceOrganization(lead.organization);
  const organizationName =
    organization?.name ??
    organization?.organization_name ??
    organization?.company ??
    null;

  const organizationCountry =
    lead.country ??
    organization?.country ??
    organization?.organization_country ??
    organization?.location ??
    null;

  const aum =
    organization?.organization_revenue_printed ??
    organization?.aum ??
    organization?.assets_under_management ??
    null;

  const companySize =
    organization?.employee_count_range ??
    organization?.organization_size ??
    organization?.company_size ??
    null;

  const companySegment =
    organization?.category ??
    organization?.segment ??
    organization?.company_segment ??
    null;

  const keywords: string[] = Array.isArray(organization?.keywords)
    ? organization.keywords
    : [];

  return {
    id: lead.id ? String(lead.id) : null,
    externalId: lead.external_id ?? null,
    name: lead.full_name ?? lead.name ?? organizationName ?? null,
    title: lead.title ?? null,
    company: organizationName,
    country: organizationCountry,
    email: lead.email ?? organization?.email ?? null,
    phone: lead.phone ?? organization?.phone ?? null,
    aum,
    companySize,
    companySegment,
    industry: organization?.industry ?? null,
    segments: Array.isArray(lead.segments) ? lead.segments : null,
    industries: Array.isArray(lead.industries) ? lead.industries : null,
    keywords,
    city: lead.city ?? organization?.city ?? null,
    state: lead.state ?? organization?.state ?? null,
    consumed: Boolean(lead.revealed_for_current_team),
    linkedinUrl: lead.linkedin_url ?? null,
    organization,
    updatedAt: lead.updatedAt ?? null,
    createdAt: lead.createdAt ?? null,
  };
};

const buildFilters = (
  search: string,
  titles: string[],
  countries: string[],
  segments: string[]
): WhereOptions<GeneralLeadsAttributes> => {
  const andConditions: any[] = [];

  if (search) {
    const likeValue = `%${search}%`;
    andConditions.push({
      [Op.or]: [
        { name: { [Op.iLike]: likeValue } },
        { full_name: { [Op.iLike]: likeValue } },
        { title: { [Op.iLike]: likeValue } },
        { email: { [Op.iLike]: likeValue } },
        { country: { [Op.iLike]: likeValue } },
      ],
    });
  }

  if (titles.length) {
    andConditions.push({
      [Op.or]: titles.map((title) => ({
        title: { [Op.iLike]: `%${title}%` },
      })),
    });
  }

  if (countries.length) {
    const normalizedCountries = countries.map((country) => country.toLowerCase());
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

  const normalizedSegments = segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length);

  if (normalizedSegments.length) {
    andConditions.push({
      segments: {
        [Op.overlap]: normalizedSegments,
      },
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

export const getACILeads = async (request: Request, response: Response) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      sendResponse(response, 401, "Authentication required");
      return;
    }

    const user = await Users.findOne({ where: { id: userId } });
    if (!user) {
      sendResponse(response, 401, "User not found");
      return;
    }

    const pageParam =
      typeof request.query.page === "string"
        ? Number.parseInt(request.query.page, 10)
        : NaN;
    const perPageParam =
      typeof request.query.perPage === "string"
        ? Number.parseInt(request.query.perPage, 10)
        : NaN;
    const limitParam =
      typeof request.query.limit === "string"
        ? Number.parseInt(request.query.limit, 10)
        : NaN;

    const page =
      Number.isNaN(pageParam) || pageParam < 1 ? DEFAULT_PAGE : pageParam;
    const limitSource = !Number.isNaN(perPageParam) ? perPageParam : limitParam;
    const limitCandidate =
      Number.isNaN(limitSource) || limitSource < 1
        ? DEFAULT_LIMIT
        : limitSource;
    const limit = Math.min(limitCandidate, MAX_LIMIT);
    const offset = (page - 1) * limit;

    const search =
      typeof request.query.search === "string"
        ? request.query.search.trim()
        : "";
    const titles = parseListParam(request.query.titles);
    const countries = parseListParam(request.query.countries);
    const segments = parseListParam(request.query.segments);

    const where = buildFilters(search, titles, countries, segments);

    const { rows, count } = await GeneralLeads.findAndCountAll({
      where,
      limit,
      offset,
      order: [["updatedAt", "DESC"]],
    });

    const leads = rows.map((lead) =>
      normalizeLead(lead.get({ plain: true }) as PlainLead)
    );

    const totalPages = limit ? Math.ceil(count / limit) : 1;

    sendResponse(response, 200, "ACI leads fetched successfully", {
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
    sendResponse(
      response,
      500,
      "Failed to fetch ACI leads",
      null,
      error?.message
    );
  }
};
