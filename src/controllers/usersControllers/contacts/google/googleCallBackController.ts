import jwt from "jsonwebtoken";
import UserLinkedAccounts, {LinkedAccountProvider} from "../../../../models/UserLinkedAccounts";
import {v4} from "uuid";
import logger from "../../../../logger";
import UserLinkedAccountTokens, {TokenScope} from "../../../../models/UserLinkedAccountTokens";
import {Request, Response} from "express";
import UserContactsStaging from "../../../../models/UserContactsStaging";
import {Op} from "sequelize";
import {google} from "googleapis";
import { SCOPE2, oauth2Client, CONTACT_FRONTEND_SUCCESS_URL, CONTACT_FRONTEND_FAILURE_URL } from "./googleConfig";


async function createAccountRecordFromIdToken(userId: string, idToken: string) {
    const decoded: any = jwt.decode(idToken);
    const googleUserId = decoded.sub;
    const email = decoded.email;
    const [record, created] = await UserLinkedAccounts.findOrCreate({
        where: {
            user_id: userId,
            provider: LinkedAccountProvider.GOOGLE,
            provider_account_id: googleUserId
        },
        defaults: {
            user_account_id: v4(),
            user_id: userId,
            provider: LinkedAccountProvider.GOOGLE,
            provider_account_id: googleUserId,
            provider_account_name: email
        }
    });

    if (!created) {
        await record.update({provider_account_name: email})
            .catch((error) => {
                logger.error(error, `Error creating UserLinkedAccounts entry: ${error?.stack || error?.message || error}.`);
                return null;
            });
    }
    const accountId = record?.user_account_id as string;
    logger.info("create account record from id token: " + accountId + " / " + userId + " / " + googleUserId + " / " + email);
    return accountId;
}

async function storeRefreshToken(accountId: string, refreshToken: string, scope: number) {
    logger.debug(`storing Refresh token for account ${accountId} scope ${scope}.`);
    const [record, created] = await UserLinkedAccountTokens.findOrCreate({
        where: {
            user_account_id: accountId,
            scope: scope,
        },
        defaults: {
            token_id: v4(),
            user_account_id: accountId,
            encrypted_refresh_token: refreshToken,
            scope: scope,
            last_used_at: new Date(),
        }
    });


    if (!created) {
        await record.update({
            encrypted_refresh_token: refreshToken,
            last_used_at: new Date(),
        })
            .catch((error) => {
                logger.error(error, `Error creating UserLinkedAccountsToken entry: ${error?.stack || error?.message || error}.`);
                return null;
            });
    }
}

export const googleCallback = async (
    request: Request,
    response: Response
) => {
    const {code, scope, state} = request.query; // state is the userId
    const userId = state as string;
    logger.info(`received consent callback for user: ${userId}`);
    if (!code) {
        logger.error('No authorization code received from Google.');
        return response.redirect(CONTACT_FRONTEND_FAILURE_URL + '&reason=no_code');
    }
    if (!scope) {
        logger.error('No authorization code received from Google.');
        return response.redirect(CONTACT_FRONTEND_FAILURE_URL + '&reason=no_scope');
    }
    try {
        const scopeArray = (scope as string).split(' ');
        if (!scopeArray.includes(SCOPE2[0])) {
            // we assume it is SCOPE1
            logger.debug('Received SCOPE1 consent');
            await handleScope1Callback(code as string, userId, response);
            return;
        } else {
            // this is the read email scope, we handle it differently
            logger.debug('Received SCOPE2 consent');
            handleScope2Callback(code as string, userId, response).catch(
                (error) => {
                    logger.error(error, `Error in handleScope2Callback: ${error?.stack || error?.message || error}.`);
                }
            );
            return;
        }

    } catch (error: any) {
        logger.error(error, `Error during Google OAuth callback: ${error?.stack || error?.message || error}.`);
        response.redirect(CONTACT_FRONTEND_FAILURE_URL + `&reason=${encodeURIComponent(error.message)}`);
    }
}

// Helper: fetch the most recently used refresh token for an account (any scope)
async function getExistingRefreshToken(accountId: string): Promise<string | null> {
    try {
        const existing = await UserLinkedAccountTokens.findOne({
            where: { user_account_id: accountId },
            order: [["last_used_at", "DESC"]],
        });
        return existing?.encrypted_refresh_token || null;
    } catch (e: any) {
        logger.error(e, `Failed to load existing refresh token for ${accountId}: ${e?.message || e}`);
        return null;
    }
}


async function handleScope1Callback(code: string, userId: string, response: Response) {
    // get token using the authorization code
    const {tokens} = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const idToken = tokens.id_token;
    let accountId: string;
    if (idToken) {
        accountId = await createAccountRecordFromIdToken(userId, idToken);
    } else {
        logger.error('No ID token received from Google.');
        response.redirect(CONTACT_FRONTEND_FAILURE_URL + '&reason=no_id_token');
        return;
    }

    if (tokens.refresh_token) {
        // Store the refresh token securely in your database for this user
        storeRefreshToken(accountId, tokens.refresh_token, TokenScope.SCOPE1).catch((error) => {
            logger.error(`Error storing refresh token: ${error?.stack || error?.message || error}.`, error);
        });

        logger.debug(`fetching fetchAllGoogleData.`);
        await fetchAllGoogleData(userId, accountId, tokens.refresh_token);
    } else {
        logger.warn('No refresh token received. User might have previously consented without offline access.');
        const existing = await getExistingRefreshToken(accountId);
        if (existing) {
            // Update last_used timestamp
            UserLinkedAccountTokens.update(
                { last_used_at: new Date() },
                { where: { user_account_id: accountId } }
            ).catch(() => {});
            logger.debug(`Using existing refresh token to fetch data.`);
            await fetchAllGoogleData(userId, accountId, existing);

    } else {
        logger.warn('No refresh token found and no existing refresh token to use.');
        response.redirect(CONTACT_FRONTEND_FAILURE_URL + '&reason=no_refresh_token');
        return;
        }
    }
    response.redirect(CONTACT_FRONTEND_SUCCESS_URL + `?accountId=${encodeURIComponent(accountId)}`);
}

async function handleScope2Callback(code: string, userId: string, response: Response) {
    const {tokens} = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const account = await UserLinkedAccounts.findOne(
        { where: { user_id: userId, provider: LinkedAccountProvider.GOOGLE } }
    );
    if (account) {
        const accountId = account.user_account_id;
        if (tokens.refresh_token) {
            // Store the refresh token securely in your database for this user
            storeRefreshToken(accountId, tokens.refresh_token, TokenScope.SCOPE2).catch((error) => {
                logger.error(error, `Error storing refresh token: ${error?.stack || error?.message || error}.`);
            });
        } else {
            logger.warn('No refresh token received. User might have previously consented without offline access.');
        }
        // for test purpose only
        // get first staged contacts that has an email and read last thread of message
        const contact = await UserContactsStaging.findOne({
            where: { user_id: userId, user_account_id: accountId, email: { [Op.ne]: '' } }
        });
        const email = contact?.email;
        logger.debug("read email from contact: " + email);
        if (email) {
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const res = await gmail.users.threads.list({
                userId: 'me',
                q: `to:${email}`,
                maxResults: 1,
            });
            logger.debug(`Gmail threads list response: ${JSON.stringify(res.data)}`);
        } else {
            logger.warn('No email found in staged contacts to test Gmail API access.');
        }
        // reload front end
        response.redirect(CONTACT_FRONTEND_SUCCESS_URL + `?accountId=${encodeURIComponent(accountId)}`);
    } else {
        logger.error('No linked account found for user when handling SCOPE2 callback.');
        response.redirect(CONTACT_FRONTEND_FAILURE_URL + '&reason=no_linked_account');
        return;
    }
}


async function fetchAllGoogleData(userId: string, userAccountId: string, refreshToken: string) {

    try {
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        // 1. Fetch all contacts with pagination
        const peopleService = google.people({ version: 'v1', auth: oauth2Client });
        let contacts: any[] = [];
        let nextPageToken: string | undefined = undefined;
        do {
            let res: any;
            res = await peopleService.people.connections.list({
                resourceName: 'people/me',
                pageSize: 100,
                personFields: 'names,emailAddresses,phoneNumbers',
                pageToken: nextPageToken,
            });
            contacts = contacts.concat(
                (res.data.connections || [])
                    //.map(mapPersonToContact)
            );
            nextPageToken = res.data.nextPageToken;
        } while (nextPageToken);

        // 2. Fetch all other contacts with pagination
        let otherContacts: any[] = [];
        let otherNextPageToken: string | undefined = undefined;
        do {
            let res: any;
            res = await peopleService.otherContacts.list({
                pageSize: 100,
                readMask: 'names,emailAddresses,phoneNumbers',
                pageToken: otherNextPageToken,
            });
            otherContacts = otherContacts.concat(
                (res.data.otherContacts || [])
                //.map(mapPersonToContact)
            );
            otherNextPageToken = res.data.nextPageToken;
        } while (otherNextPageToken);

        const allContacts =  contacts.concat(otherContacts);
        await storeFetchedContacts(userId, userAccountId, allContacts);
    } catch (error: any) {
        logger.error(`Error fetching all Google data: ${error?.stack || error?.message || error}.`, error);
        throw error; // Propagate the error to the caller
    }
}

async function storeFetchedContacts(userId: string, userAccountId: string , contacts: any[]) {
    logger.debug(`Storing contacts for user ${userId} / accountID ${userAccountId} with ${contacts.length} contacts`);

    try {
        logger.debug(JSON.stringify(contacts));
        const contactsToUpsert = contacts.map((contact: any) => {
            logger.debug("contactId:"+ contact.resourceName);
            logger.debug(`contact`+ JSON.stringify(contact));

            const email = contact.emailAddresses?.[0]?.value || null;
            const fullName = contact.names?.[0]?.displayName || null;
            const phone = contact.phoneNumbers?.[0]?.value || null;
            const validation_required =
                !fullName || fullName.trim() === '' || !fullName.includes(' ') ||
                (!email && !phone);
            logger.debug(`contact ${fullName} / validation_required ${validation_required} / $email ${email} / phone ${phone} / name ${fullName}`);

            return {
                contact_id: v4(),
                user_id: userId,
                user_account_id:userAccountId ,
                source_contact_id: contact.resourceName,
                raw_data: contact,
                first_name: contact.names?.[0]?.givenName || null,
                last_name: contact.names?.[0]?.familyName || null,
                full_name: fullName,
                email: email,
                phone: phone,
                is_complete: false,
                validation_required: validation_required,
                is_skipped: false,
            };
        });
        await UserContactsStaging.bulkCreate(contactsToUpsert, {
            updateOnDuplicate: [
                'raw_data',
                'first_name',
                'last_name',
                'full_name',
                'email',
                'phone',
                'is_complete',
                'validation_required',
                'is_skipped',
            ],
            conflictAttributes: ['user_id', 'user_account_id', 'source_contact_id']
        });
        logger.debug(`Successfully stored ${contactsToUpsert.length} contacts for user ID ${userId}`);
    } catch (error: any) {
        logger.error(error, `Error storing contacts for user ID ${userId} / accountId ${userAccountId}: ${error?.stack || error?.message || error}.`);
        throw error;
    }
}