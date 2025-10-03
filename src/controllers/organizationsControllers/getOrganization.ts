import { Request, Response } from "express";
import Organizations from "../../models/Organizations";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

export const getOrganization = async (request: Request, response: Response) => {
    try {
        const { organization_id } = request.params;

        if (!organization_id) {
            return sendResponse(response, 400, "Organization ID is required");
        }

        const organization = await Organizations.findOne({
            where: { organization_id },
        });

        if (!organization) {
            return sendResponse(response, 404, "Organization not found");
        }

        return sendResponse(response, 200, "Organization retrieved successfully", {
            organization,
        });
    } catch (error: any) {
        logger.error(error, "Get Organization Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};