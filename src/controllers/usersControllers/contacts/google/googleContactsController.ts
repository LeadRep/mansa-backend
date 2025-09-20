import {JwtPayload} from "jsonwebtoken";
import {Response} from "express";
import logger from "../../../../logger";
import { SCOPE1, SCOPE2, oauth2Client } from "./googleConfig";


const generateGoogleAuthUrl = (userId: string, scope: string[]) => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope,
        prompt: 'select_account',
        state: userId,
        response_type: 'code',
    });
};


// CONSENTS CONTROLLERS
export const googleConsentBasicDetails = async (
    request: JwtPayload,
    response: Response
) => {
    try {
        const userId = request.user.id;
        logger.info(`google consent required for user ID: ${userId}`);
        const authorizeUrl = generateGoogleAuthUrl(userId, SCOPE1);
        response.status(200).json({ authorizeUrl});
    } catch (err) {
        response.status(500).json({ error: "Failed to generate consent URL" });
    }
};

export const googleConsentReadEmail = async (
    request: JwtPayload,
    response: Response
) => {
    try {
        const userId = request.user.id;
        logger.info(`google consent required for user ID: ${userId}`);
        const authorizeUrl = generateGoogleAuthUrl(userId, SCOPE2);
        response.status(200).json({ authorizeUrl});
    } catch (err) {
        response.status(500).json({ error: "Failed to generate consent URL" });
    }
};

