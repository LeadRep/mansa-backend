import { Request, Response } from "express";
import Organizations from "../../models/Organizations";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";

export const getOrganization = async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;

        const { organization_id } = request.params;

        if (!organization_id) {
            return sendResponse(response, 400, "Organization ID is required");
        }

        const org = await Organizations.findOne({
            where: { organization_id },
        });

        if (!org) {
            return sendResponse(response, 404, "Organization not found");
        }

        const users = await Users.findAll(
            { where: { organization_id: organization_id } }
        );
        const userResp = users.map(u => u.get({plain: true}));

        //check if userId is part of userResp
        const isCallerPartOfOrg = userResp.some(u => u.id === userId);

        if (!isCallerPartOfOrg) {
            return sendResponse(response, 403, "Forbidden: insufficient permissions");
        }

        const organization = { ...org.get({plain: true}), users: userResp };

        return sendResponse(response, 200, "Organization retrieved successfully", {
            organization
        });
    } catch (error: any) {
        logger.error(error, "Get Organization Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};