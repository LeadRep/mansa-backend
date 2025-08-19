import {JwtPayload} from "jsonwebtoken";
import {Request, Response} from "express";
import {ContactProvider, UserContacts, UserContactsStatus} from "../../models/UserContacts";
import {v4} from "uuid";
import {JSONB} from "sequelize";
import logger from "../../logger";
const { google } = require('googleapis');

const CLIENT_ID = process.env.CONTACT_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.CONTACT_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.CONTACT_GOOGLE_REDIRECT_URI;
const CONTACT_FRONTEND_SUCCESS_URL = process.env.CONTACT_FRONTEND_SUCCESS_URL || `${process.env.REACT_APP_FRONTEND_URL}/contacts?google_auth_status=success`;
const CONTACT_FRONTEND_FAILURE_URL = process.env.CONTACT_FRONTEND_FAILURE_URL || `${process.env.REACT_APP_FRONTEND_URL}/contacts?google_auth_status=error`;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const SCOPES = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts.other.readonly',
    'email'
];

export const googleConsent = async (
    request: JwtPayload,
    response: Response
) => {
    const userId = request.user.id;
    logger.info('google consent required for user ID:', userId);

    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // This is crucial to get a refresh token
        scope: SCOPES,
        prompt: 'consent select_account', // once stable, we will remove consent and use 'select_account' to avoid asking for consent every time
        state: userId,
        response_type: 'code' // 'code' is needed to get the authorization code
    });
    response.status(200).json({ authorizeUrl});
};

export const googleCallback = async (
    request: Request,
    response: Response
) => {
    const {code, state} = request.query; // state is the userId
    logger.info(`received consent callback for user: ${String(state)}`);
    if (!code) {
        logger.error('No authorization code received from Google.');
        return response.redirect(CONTACT_FRONTEND_FAILURE_URL + '&reason=no_code');
    }

    try {
        // get token using the authorization code
        const {tokens} = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const userId = state as string;
        if (tokens.refresh_token) {
            // get email
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            const userEmail = userInfo.data.email;

            // Store the refresh token securely in your database for this user
            const id = await storeUserRefreshToken(userId, tokens.refresh_token, userEmail);
            logger.debug(`Refresh token stored for user ${userId} and email ${userEmail}.`);

            fetchAllGoogleData(id, tokens.refresh_token).catch((err) => {
                logger.error('Error in fetchAllGoogleData:', err);
            });
        } else {
            logger.warn('No refresh token received. User might have previously consented without offline access.');
            // TODO: Handle cases where refresh token isn't provided (e.g., if access_type was not 'offline' previously)
            // for now access type is ofline and we force the consent, so this should not happen
        }
        response.redirect(CONTACT_FRONTEND_SUCCESS_URL);

    } catch (error: any) {
        logger.error('Error during Google OAuth callback:', error);
        response.redirect(CONTACT_FRONTEND_FAILURE_URL + `&reason=${encodeURIComponent(error.message)}`);
    }
}

export const googleContacts = async (
    request: JwtPayload,
    response: Response
) => {
    const userId = request.user.id;
    // fetch all contacts from UserContacts table for a specific user
    // return an array of objects with id, email, provider, contacts_json
    try {
        const userContacts = await UserContacts.findAll({
            where: { user_id: userId, provider: ContactProvider.GOOGLE },
            attributes: ['id', 'provider', 'contacts_json']
        });

        // flatten the contacts_json field to have an array of objects
        // with fields: name, email, phone and provider
        const flattenedContacts = userContacts.map((contact: any) => {
            const contacts = contact.contacts_json || [];
            return contacts.map((c: any) => ({
                name: c.name || 'Unknown Name',
                email: c.email || 'No Email',
                phone: c.phone || 'No Phone',
                provider: contact.provider,
            }));
        }).flat();

        // TODO: check the status and respond accordingly

        response.status(200).json({ data: flattenedContacts});
    } catch (error: any) {
        logger.error('Error fetching user contacts:', error);
        response.status(500).json({ message: 'Internal server error.' });
    }
}


async function fetchAllGoogleData(id: string, refreshToken: string) {

    try {
        // get refresh token from UserContacts table if the input is null or undefined
        if (!refreshToken) {
            refreshToken = await getUserRefreshToken(id, ContactProvider.GOOGLE);
            if (!refreshToken) {
                logger.error(`No refresh token found for user contactId : ${id}`);
                return;
            }
        }
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
                (res.data.connections || []).map(mapPersonToContact)
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
                (res.data.otherContacts || []).map(mapPersonToContact)
            );
            otherNextPageToken = res.data.nextPageToken;
        } while (otherNextPageToken);

        const allContacts =  contacts.concat(otherContacts);
        await updateUserContactContacts(id, allContacts)
    } catch (error: any) {
        logger.error('Error fetching all Google data:', error);
        throw error; // Propagate the error to the caller
    }
}



async function storeUserRefreshToken(userId: string, refreshToken: string, email: string) {
    // TODO refresh token should be encrypted at rest
    try {
        const created = await UserContacts.create({
            id: v4(),
            user_id: userId,
            refresh_token: refreshToken,
            provider_reference: email,
            provider: ContactProvider.GOOGLE,
            status: UserContactsStatus.INIT,
            contacts_json: {}
        });
        return created.id;
    } catch (error: any) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            logger.warn(`Refresh token already exists for user ${userId}/${email}. Fetching existing contact ID.`);
            const existing = await UserContacts.findOne({
                where: {
                    user_id: userId,
                    provider: ContactProvider.GOOGLE,
                    provider_reference: email,
                }
            });
            if (existing) {
                await existing.update({ refresh_token: refreshToken });
                return existing.id;
            }
            return null;
        }
        logger.error(`Error storing refresh token for user ${userId}/${email}:`, error);
        throw error;
    }
}

async function updateUserContactContacts(id: string , contacts: any[]) {
    logger.debug(`Updating contacts records for id ${id}  with ${contacts.length} contacts`);
    try {
        await UserContacts.update(
            { contacts_json: contacts, status: UserContactsStatus.CONTACTS_SET },
            { where: { id: id } }
        )
    } catch (error: any) {
        logger.error(`Error updating contact record ${id} with ${contacts.length} contacts:`, error);
        throw error;
    }
}

async function getUserRefreshToken(userId : string, provider: ContactProvider = ContactProvider.GOOGLE) {
    logger.debug(`Retrieving refresh token for ${userId}`);
    const contact = await UserContacts.findOne({
        where: { user_id: userId, provider: provider },
        attributes: ['refresh_token']
    });
    return contact ? contact.refresh_token : null;
}

function mapPersonToContact(person: any) {
    return {
        name: person.names?.[0]?.displayName || 'Unknown Name',
        email: person.emailAddresses?.[0]?.value || 'No Email',
        phone: person.phoneNumbers?.[0]?.value || 'No Phone',
    };
}