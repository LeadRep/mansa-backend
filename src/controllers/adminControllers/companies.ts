import { Request, Response } from "express";
import Companies from "../../models/Companies";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { Op } from "sequelize";

export const getCompanies = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search as string;

        const whereClause: any = {};
        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { count, rows } = await Companies.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });

        sendResponse(res, 200, "Companies fetched successfully", {
            companies: rows,
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
        });
    } catch (error: any) {
        logger.error(error, "Error in getCompanies:");
        sendResponse(res, 500, "Internal server error", null, error.message);
    }
};
