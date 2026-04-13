import { Request, Response } from "express";
import { Op } from "sequelize";
import Companies from "../../models/Companies";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

export const userCompanies = async (request: Request, response: Response) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = String(request.query.search || "").trim();
    const industry = String(request.query.industry || "").trim();
    const country = String(request.query.country || "").trim();
    const minEmployees = Number(request.query.minEmployees);
    const maxEmployees = Number(request.query.maxEmployees);
    const hasWebsite = String(request.query.hasWebsite || "").trim() === "true";
    const hasLinkedin = String(request.query.hasLinkedin || "").trim() === "true";
    const hasTwitter = String(request.query.hasTwitter || "").trim() === "true";
    const hasPhone = String(request.query.hasPhone || "").trim() === "true";

    const whereClause: any = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { industry: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
        { country: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (industry) {
      whereClause.industry = { [Op.iLike]: `%${industry}%` };
    }

    if (country) {
      whereClause.country = { [Op.iLike]: `%${country}%` };
    }

    if (!Number.isNaN(minEmployees) || !Number.isNaN(maxEmployees)) {
      whereClause.estimated_num_employees = {};
      if (!Number.isNaN(minEmployees)) {
        whereClause.estimated_num_employees[Op.gte] = minEmployees;
      }
      if (!Number.isNaN(maxEmployees)) {
        whereClause.estimated_num_employees[Op.lte] = maxEmployees;
      }
    }

    if (hasWebsite) {
      whereClause.primary_domain = { [Op.not]: null };
    }

    if (hasLinkedin) {
      whereClause.linkedin_url = { [Op.not]: null };
    }

    if (hasTwitter) {
      whereClause.twitter_url = { [Op.not]: null };
    }

    if (hasPhone) {
      whereClause.phone = { [Op.not]: null };
    }

    const { count, rows } = await Companies.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    sendResponse(response, 200, "Companies fetched successfully", {
      companies: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error: any) {
    logger.error(error, "Error fetching companies for user");
    sendResponse(response, 500, "Internal server error", null, error.message);
  }
};

export const userCompanyFilterOptions = async (
  _request: Request,
  response: Response
) => {
  try {
    const [industryRows, countryRows] = await Promise.all([
      Companies.findAll({
        attributes: ["industry"],
        where: {
          industry: {
            [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }],
          },
        },
        group: ["industry"],
        order: [["industry", "ASC"]],
        raw: true,
      }),
      Companies.findAll({
        attributes: ["country"],
        where: {
          country: {
            [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }],
          },
        },
        group: ["country"],
        order: [["country", "ASC"]],
        raw: true,
      }),
    ]);

    sendResponse(response, 200, "Company filter options fetched successfully", {
      industries: industryRows
        .map((row: any) => row.industry)
        .filter(Boolean),
      countries: countryRows
        .map((row: any) => row.country)
        .filter(Boolean),
    });
  } catch (error: any) {
    logger.error(error, "Error fetching company filter options");
    sendResponse(response, 500, "Internal server error", null, error.message);
  }
};
