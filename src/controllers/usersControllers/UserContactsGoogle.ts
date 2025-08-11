import {JwtPayload} from "jsonwebtoken";
import {Request, Response} from "express";
import {ContactProvider, UserContacts, UserContactsStatus} from "../../models/UserContacts";
import {v4} from "uuid";
import {JSONB} from "sequelize";
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const FRONTEND_SUCCESS_URL = process.env.FRONTEND_SUCCESS_URL || 'http://localhost:3000/dashboard?google_auth_status=success';
const FRONTEND_FAILURE_URL = process.env.FRONTEND_FAILURE_URL || 'http://localhost:3000/settings?google_auth_status=failure';

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
    console.log('Consent required for user ID:', userId);

    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // This is crucial to get a refresh token
        scope: SCOPES,
        prompt: 'consent', // Forces consent screen even if already consented
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
    console.debug('received consent callback for user:', state);
    if (!code) {
        console.error('No authorization code received from Google.');
        return response.redirect(FRONTEND_FAILURE_URL + '&reason=no_code');
    }

    try {
        const {tokens} = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const userId = state as string; // Replace with actual user ID from your session/DB
        if (tokens.refresh_token) {
            // Store the refresh token securely in your database for this user
            const id = await storeUserRefreshToken(userId, tokens.refresh_token);
            console.log(`Refresh token stored for user ${userId}.`);

            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            const userEmail = userInfo.data.email;
            await updateUserContactEmail(id, userEmail); // Update user's email in your DB

            fetchAllGoogleData(id, tokens.refresh_token).catch((err) => {
                console.error('Error in fetchAllGoogleData:', err);
            });
        } else {
            console.warn('No refresh token received. User might have previously consented without offline access.');
            // TODO Handle cases where refresh token isn't provided (e.g., if access_type was not 'offline' previously)
        }
        response.redirect(FRONTEND_SUCCESS_URL);

    } catch (error: any) {
        console.error('Error during Google OAuth callback:', error);
        response.redirect(FRONTEND_FAILURE_URL + `&reason=${encodeURIComponent(error.message)}`);
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
        console.error('Error fetching user contacts:', error);
        response.status(500).json({ message: 'Internal server error.' });
    }
}


async function fetchAllGoogleData(id: string, refreshToken: string) {

    // get refresh token from UserContacts table if the input is null or empty
    if (!refreshToken) {
        refreshToken = await getUserRefreshToken(id, ContactProvider.GOOGLE);
        if (!refreshToken) {
            console.error('No refresh token found for user:', id);
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
            (res.data.connections || []).map((person: any) => ({
                name: person.names?.[0]?.displayName || 'Unknown Name',
                email: person.emailAddresses?.[0]?.value || 'No Email',
                phone: person.phoneNumbers?.[0]?.value || 'No Phone',
            }))
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
            (res.data.otherContacts || []).map((person: any) => ({
                name: person.names?.[0]?.displayName || 'Unknown Name',
                email: person.emailAddresses?.[0]?.value || 'No Email',
                phone: person.phoneNumbers?.[0]?.value || 'No Phone',
            }))
        );
        otherNextPageToken = res.data.nextPageToken;
    } while (otherNextPageToken);

    const allContacts =  contacts.concat(otherContacts);
    await updateUserContactContacts(id, allContacts)
}



async function storeUserRefreshToken(userId: string, refreshToken: string) {
    console.log(`Storing refresh token for ${userId}`);

    try {
        const created = await UserContacts.create({
            id: v4(),
            user_id: userId,
            refresh_token: refreshToken,
            email: 'heemega@gmail.com',
            provider: ContactProvider.GOOGLE,
            status: UserContactsStatus.INIT,
            contacts_json: JSONB()
        });
        return created.id;
    } catch (error: any) {
        console.error(`Error storing refresh token for user ${userId}:`, error);
        return null
    }
}

async function updateUserContactEmail(id: string , email: string) {
    console.log(`Updating  contact email token for ${email}`);
    try {
        UserContacts.update(
            { email: email, status: UserContactsStatus.EMAIL_SET },
            { where: { id: id } }
        )
    } catch (error: any) {
        console.error(`Error storing updating contact record ${id} with email ${email}:`, error);
    }
}

async function updateUserContactContacts(id: string , contacts: any[]) {
    console.log(`Updating  contacts records for id${id}  with ${contacts.length} contacts`);
    try {
        UserContacts.update(
            { contacts_json: contacts, status: UserContactsStatus.CONTACTS_SET },
            { where: { id: id } }
        )
    } catch (error: any) {
        console.error(`Error updating contact record ${id} with ${contacts.length} contacts:`, error);
    }
}

async function getUserRefreshToken(userId : string, provider: ContactProvider = ContactProvider.GOOGLE) {
    console.log(`[Retrieving refresh token for ${userId}`);
    const contact = await UserContacts.findOne({
        where: { user_id: userId, provider: provider },
        attributes: ['refresh_token']
    });
    return contact ? contact.refresh_token : null;
}