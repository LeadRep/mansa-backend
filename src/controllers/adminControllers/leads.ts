import { Request, Response } from "express";
import { GeneralLeads } from "../../models/GeneralLeads";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { Op } from "sequelize";

export const getGeneralLeads = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const {
            search,
            industry,
            country,
            title,
            email_status
        } = req.query;

        const whereClause: any = {};

        if (search) {
            whereClause[Op.or] = [
                { full_name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (industry) {
            whereClause.industries = { [Op.contains]: [industry] };
        }

        if (country) {
            whereClause.country = { [Op.iLike]: `%${country}%` };
        }

        if (title) {
            whereClause.title = { [Op.iLike]: `%${title}%` };
        }

        if (email_status) {
            whereClause.email_status = email_status;
        }

        const { count, rows } = await GeneralLeads.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });

        sendResponse(res, 200, "General leads fetched successfully", {
            leads: rows,
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
        });
    } catch (error: any) {
        logger.error(error, "Error in getGeneralLeads:");
        sendResponse(res, 500, "Internal server error", null, error.message);
    }
};
