import { Request, Response } from "express";
import Invitations from "../../models/Invitations";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

export const ValidateInvite = async (request: Request, response: Response) => {
    try {
        let token = request.query.token;
console.log("RVRV token");
        console.log(token);

        if (Array.isArray(token)) {
            token = token[0];
        }
        if (typeof token !== "string" || !token) {
            return sendResponse(response, 400, "Token is required");
        }

        // Find the invitation
        const invitation = await Invitations.findOne({
            where: { token: token, status: "pending" }
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