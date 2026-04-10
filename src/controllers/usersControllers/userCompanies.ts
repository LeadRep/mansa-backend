import { Request, Response } from "express";
import { Op } from "sequelize";
import Companies from "../../models/Companies";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

export const userCompanies = async (request: Request, response: Response) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(request.query.limit) || 24));
    const offset = (page - 1) * limit;
    const search = String(request.query.search || "").trim();

    const whereClause: any = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { industry: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
        { country: { [Op.iLike]: `%${search}%` } },
      ];
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
