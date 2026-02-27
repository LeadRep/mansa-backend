import { Request, Response } from "express";
import Invitations from "../../models/Invitations";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Organizations from "../../models/Organizations";

export const ValidateInvite = async (request: Request, response: Response) => {
    try {
        let token = request.query.token;
        logger.debug({ hasToken: !!token }, "ValidateInvite received token query parameter");

        if (Array.isArray(token)) {
            token = token[0];
        }
        if (typeof token !== "string" || !token) {
            return sendResponse(response, 400, "Token is required");
        }

        // Find the invitation
        const invitation = await Invitations.findOne({
            where: { token: token, status: "pending" },
            include: [
              {
                model: Organizations,
                as: "organization",
                attributes: ['name', 'organization_id'] // Specify which fields you want
              }
            ]
        });

        if (!invitation) {
            return sendResponse(response, 404, "Invalid or expired invitation");
        }

        return sendResponse(response, 200, "Invitation valid.", { invitation });
    } catch (error: any) {
        logger.error(error, "validate Invite Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};