import {JwtPayload} from "jsonwebtoken";
import {Response} from "express";
import logger from "../../../../logger";
import { SCOPE1, SCOPE2, SCOPE3, oauth2Client } from "./googleConfig";

type GoogleAuthState = {
    userId: string;
    successRedirect?: string;
    failureRedirect?: string;
};

export const encodeGoogleAuthState = (state: GoogleAuthState) =>
    Buffer.from(JSON.stringify(state)).toString("base64url");

export const decodeGoogleAuthState = (value: string): GoogleAuthState | null => {
    try {
        return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    } catch (_error) {
        return null;
    }
};

export const generateGoogleAuthUrl = (
    userId: string,
    scope: string[],
    options?: {
        successRedirect?: string;
        failureRedirect?: string;
        prompt?: string;
    }
) => {
    const state = encodeGoogleAuthState({
        userId,
        successRedirect: options?.successRedirect,
        failureRedirect: options?.failureRedirect,
    });

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope,
        prompt: options?.prompt || 'select_account',
        state,
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

export const googleConsentSendEmail = async (
    request: JwtPayload,
    response: Response
) => {
    try {
        const userId = request.user.id;
        logger.info(`google send consent required for user ID: ${userId}`);
        const authorizeUrl = generateGoogleAuthUrl(userId, SCOPE3, {
            prompt: "consent select_account",
        });
        response.status(200).json({ authorizeUrl });
    } catch (err) {
        response.status(500).json({ error: "Failed to generate consent URL" });
    }
};

