import { Request, Response } from "express";
import { Op } from "sequelize";
import Users from "../../models/Users";
import ACICompanies from "../../models/ACICompanies";
import ACICompanyExclusions from "../../models/ACICompanyExclusions";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const COMPANY_SEARCH_MAX_LIMIT = 20;
const MIN_SEARCH_LENGTH = 2;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value: unknown): value is string => {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
};

const getUserFromRequest = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const user = await Users.findOne({ where: { id: userId } });

  if (!user) {
    sendResponse(res, 401, "User not found");
    return null;
  }

  return user;
};

export const excludeAciCompany = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req, res);
    if (!user) {
      return;
    }

    const companyId =
      typeof req.body?.companyId === "string" ? req.body.companyId.trim() : "";

    if (!isValidUuid(companyId)) {
      sendResponse(res, 400, "companyId must be a valid UUID");
      return;
    }

    const company = await ACICompanies.findByPk(companyId);
    if (!company) {
      sendResponse(res, 404, "ACI company not found");
      return;
    }

    const [exclusion, created] = await ACICompanyExclusions.findOrCreate({
      where: {
        organizationId: user.organization_id,
        companyId,
      },
      defaults: {
        organizationId: user.organization_id,
        companyId,
        excludedByUserId: user.id,
      },
    });

    sendResponse(
      res,
      200,
      created ? "Company excluded successfully" : "Company already excluded",
      {
        data: {
          company,
          exclusion,
          alreadyExcluded: !created,
        },
      }
    );
  } catch (error: any) {
    logger.error(
      { error: error?.message, stack: error?.stack },
      "Failed to exclude ACI company"
    );
    sendResponse(res, 500, "Failed to exclude ACI company", null, error?.message);
  }
};

export const includeAciCompany = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req, res);
    if (!user) {
      return;
    }

    const companyId =
      typeof req.params.companyId === "string" ? req.params.companyId.trim() : "";

    if (!isValidUuid(companyId)) {
      sendResponse(res, 400, "companyId must be a valid UUID");
      return;
    }

    const deletedCount = await ACICompanyExclusions.destroy({
      where: {
        organizationId: user.organization_id,
        companyId,
      },
    });

    sendResponse(res, 200, "Company exclusion removed successfully", {
      data: {
        companyId,
        removed: deletedCount > 0,
      },
    });
  } catch (error: any) {
    logger.error(
      { error: error?.message, stack: error?.stack },
      "Failed to remove ACI company exclusion"
    );
    sendResponse(
      res,
      500,
      "Failed to remove ACI company exclusion",
      null,
      error?.message
    );
  }
};

export const listExcludedAciCompanies = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req, res);
    if (!user) {
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
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const page = Number.isNaN(pageParam) || pageParam < 1 ? DEFAULT_PAGE : pageParam;
    const limitCandidate =
      Number.isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam;
    const limit = Math.min(limitCandidate, MAX_LIMIT);
    const offset = (page - 1) * limit;

    const companyWhere = search
      ? {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { primary_domain: { [Op.iLike]: `%${search}%` } },
            { country: { [Op.iLike]: `%${search}%` } },
            { city: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : undefined;

    const { rows, count } = await ACICompanyExclusions.findAndCountAll({
      where: {
        organizationId: user.organization_id,
      },
      include: [
        {
          model: ACICompanies,
          as: "company",
          required: true,
          ...(companyWhere ? { where: companyWhere } : {}),
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const totalPages = limit ? Math.ceil(count / limit) : 1;

    const data = rows.map((item: any) => {
      const exclusion = item.get({ plain: true });
      return {
        exclusionId: exclusion.id,
        companyId: exclusion.companyId,
        excludedByUserId: exclusion.excludedByUserId,
        excludedAt: exclusion.createdAt,
        company: exclusion.company,
      };
    });

    sendResponse(res, 200, "Excluded ACI companies fetched successfully", {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
      },
      filtersApplied: {
        search: search || null,
      },
    });
  } catch (error: any) {
    logger.error(
      { error: error?.message, stack: error?.stack },
      "Failed to list excluded ACI companies"
    );
    sendResponse(
      res,
      500,
      "Failed to list excluded ACI companies",
      null,
      error?.message
    );
  }
};

export const searchAciCompanies = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req, res);
    if (!user) {
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
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : typeof req.query.query === "string"
          ? req.query.query.trim()
          : "";
    const page = Number.isNaN(pageParam) || pageParam < 1 ? DEFAULT_PAGE : pageParam;
    const limitCandidate =
      Number.isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam;
    const limit = Math.min(limitCandidate, COMPANY_SEARCH_MAX_LIMIT);
    const offset = (page - 1) * limit;

    if (search.length < MIN_SEARCH_LENGTH) {
      sendResponse(res, 200, "ACI companies fetched successfully", {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        filtersApplied: {
          search: search || null,
        },
      });
      return;
    }

    const where = {
      name: {
        [Op.iLike]: `%${search}%`,
      },
    };

    const { rows, count } = await ACICompanies.findAndCountAll({
      where,
      order: [["name", "ASC"]],
      limit,
      offset,
      distinct: true,
      attributes: [
        "id",
        "external_id",
        "name",
        "primary_domain",
        "city",
        "country",
        "logo_url",
        "website_url",
      ],
    });

    const totalPages = limit ? Math.ceil(count / limit) : 1;

    const data = rows.map((company: any) => company.get({ plain: true }));

    sendResponse(res, 200, "ACI companies fetched successfully", {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
      },
      filtersApplied: {
        search: search || null,
      },
    });
  } catch (error: any) {
    logger.error(
      { error: error?.message, stack: error?.stack },
      "Failed to search ACI companies"
    );
    sendResponse(res, 500, "Failed to search ACI companies", null, error?.message);
  }
};