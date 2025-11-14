import { Request, Response } from "express";
import { Op, WhereOptions } from "sequelize";
import sendResponse from "../../utils/http/sendResponse";
import {
  GeneralLeads,
  GeneralLeadsAttributes,
} from "../../models/GeneralLeads";
import logger from "../../logger";
import {normalizeLead, PlainLead} from "./utils";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
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

    if (segments.length) {
        andConditions.push({
            segments: { [Op.overlap]: segments },
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

    const where = buildFilters(search, titles, countries, segments);

    const { rows, count } = await GeneralLeads.findAndCountAll({
      where,
      limit,
      offset,
      order: [["priority", "DESC"], ["createdAt", "DESC"]],
    });

    const leads = rows.map((lead) =>
      normalizeLead(lead.get({ plain: true }) as PlainLead)
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
