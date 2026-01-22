import {google} from "googleapis";

const CLIENT_ID = process.env.CONTACT_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.CONTACT_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.CONTACT_GOOGLE_REDIRECT_URI;
export const CONTACT_FRONTEND_SUCCESS_URL = process.env.CONTACT_FRONTEND_SUCCESS_URL || `${process.env.APP_DOMAIN}/contacts?google_auth_status=success`;
export const CONTACT_FRONTEND_FAILURE_URL = process.env.CONTACT_FRONTEND_FAILURE_URL || `${process.env.APP_DOMAIN}/contacts?google_auth_status=error`;

export const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

export const SCOPE1 = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts.other.readonly',
    'email',
    'openid'
];

export const SCOPE2 = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'openid',
]