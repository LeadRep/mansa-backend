import { Request, Response } from "express";
import { v4 } from "uuid";
import logger from "../../../../logger";
import UserLinkedAccounts, { LinkedAccountProvider } from "../../../../models/UserLinkedAccounts";
import UserLinkedAccountTokens, { TokenScope } from "../../../../models/UserLinkedAccountTokens";
import {
    decodeMicrosoftAuthState,
    exchangeCodeForTokens,
    getMicrosoftUserProfile,
    sendEmailViaGraph,
    MICROSOFT_FRONTEND_FAILURE_URL,
    MICROSOFT_FRONTEND_SUCCESS_URL,
} from "./microsoftConfig";

const appendReason = (baseUrl: string, reason: string) => {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}reason=${encodeURIComponent(reason)}`;
};

export const microsoftCallback = async (request: Request, response: Response) => {
    const { code, state, error } = request.query;

    logger.info(`Microsoft OAuth callback received. Code: ${code ? "present" : "missing"}, State: ${state ? "present" : "missing"}`);

    const decodedState = state ? decodeMicrosoftAuthState(String(state)) : null;
    const userId = decodedState?.userId || String(state || "");
    const successRedirectUrl = decodedState?.successRedirect || MICROSOFT_FRONTEND_SUCCESS_URL;
    const failureRedirectUrl = decodedState?.failureRedirect || MICROSOFT_FRONTEND_FAILURE_URL;

    logger.info(`Decoded state. UserId: ${userId}, Success URL: ${successRedirectUrl}`);

    if (error) {
        logger.error(`Microsoft OAuth error received: ${error}`);
        return response.redirect(appendReason(failureRedirectUrl, String(error)));
    }

    if (!code) {
        logger.error("No authorization code received from Microsoft.");
        return response.redirect(appendReason(failureRedirectUrl, "no_code"));
    }

    if (!userId) {
        logger.error("No userId found in Microsoft OAuth state.");
        return response.redirect(appendReason(failureRedirectUrl, "no_user"));
    }

    try {
        logger.info(`Exchanging authorization code for tokens. UserId: ${userId}`);
        const tokens = await exchangeCodeForTokens(String(code));
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token;

        logger.info(`Tokens received. HasRefreshToken: ${!!refreshToken}`);

        if (!refreshToken) {
            logger.warn("No refresh token received from Microsoft. This may cause issues later.");
        }

        logger.info(`Fetching Microsoft user profile`);
        const profile = await getMicrosoftUserProfile(accessToken);
        const microsoftUserId = profile.id;
        const email = profile.mail || profile.userPrincipalName || "";

        logger.info(`Microsoft user profile fetched. UserId: ${microsoftUserId}, Email: ${email}`);

        const [account] = await UserLinkedAccounts.findOrCreate({
            where: {
                user_id: userId,
                provider: LinkedAccountProvider.OUTLOOK,
                provider_account_id: microsoftUserId,
            },
            defaults: {
                user_account_id: v4(),
                user_id: userId,
                provider: LinkedAccountProvider.OUTLOOK,
                provider_account_id: microsoftUserId,
                provider_account_name: email,
            },
        });

        logger.info(`UserLinkedAccounts record created/found. AccountId: ${account.user_account_id}`);

        if (email) {
            await account.update({ provider_account_name: email }).catch((err: any) => {
                logger.error(err, "Error updating provider_account_name for Microsoft account");
            });
        }

        const accountId = account.user_account_id as string;

        if (refreshToken) {
            logger.info(`Storing refresh token for account: ${accountId}`);
            const [tokenRecord, tokenCreated] = await UserLinkedAccountTokens.findOrCreate({
                where: {
                    user_account_id: accountId,
                    scope: TokenScope.SCOPE3,
                },
                defaults: {
                    token_id: v4(),
                    user_account_id: accountId,
                    encrypted_refresh_token: refreshToken,
                    scope: TokenScope.SCOPE3,
                    last_used_at: new Date(),
                },
            });

            if (!tokenCreated) {
                logger.info(`Updating existing refresh token for account: ${accountId}`);
                await tokenRecord
                    .update({ encrypted_refresh_token: refreshToken, last_used_at: new Date() })
                    .catch((err: any) => {
                        logger.error(err, "Error updating Microsoft refresh token");
                    });
            } else {
                logger.info(`New token record created for account: ${accountId}`);
            }
        } else {
            logger.warn("Skipping token storage because no refresh token was received");
        }

        // Send email if email data was provided in state
        const decodedStateData = decodeMicrosoftAuthState(String(request.query.state || ""));
        if (decodedStateData?.emailData) {
            try {
                logger.info(`Attempting to send email to ${decodedStateData.emailData.to} (subject: "${decodedStateData.emailData.subject}")`);
                const emailResult = await sendEmailViaGraph(
                    accessToken,
                    decodedStateData.emailData.to,
                    decodedStateData.emailData.subject,
                    decodedStateData.emailData.body
                );
                logger.info(`Email sent successfully to ${decodedStateData.emailData.to} - Status: ${emailResult.status} ${emailResult.statusText}`);
            } catch (emailError: any) {
                logger.error(emailError, `Failed to send email after OAuth for user ${userId}`);
                const separator = failureRedirectUrl.includes("?") ? "&" : "?";
                const redirectUrl = `${failureRedirectUrl}${separator}reason=${encodeURIComponent(emailError.message || "Failed to send email")}`;
                return response.redirect(redirectUrl);
            }
        } else {
            logger.warn("No email data found in decoded state, skipping email send");
        }

        const separator = successRedirectUrl.includes("?") ? "&" : "?";
        const emailWasSent = decodedStateData?.emailData ? "true" : "false";
        const redirectUrl = `${successRedirectUrl}${separator}accountId=${encodeURIComponent(accountId)}&email_sent=${emailWasSent}`;
        logger.info(`Redirecting to: ${redirectUrl}`);
        return response.redirect(redirectUrl);
    } catch (err: any) {
        logger.error(
            err,
            `Error during Microsoft OAuth callback: ${err?.stack || err?.message || err}`
        );
        const redirectUrl = appendReason(failureRedirectUrl, err.message || "unknown_error");
        logger.info(`Redirecting to failure URL: ${redirectUrl}`);
        return response.redirect(redirectUrl);
    }
};
