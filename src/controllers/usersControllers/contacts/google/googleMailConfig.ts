import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_MAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_MAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_MAIL_REDIRECT_URI;

export const mailOAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

export const MAIL_SCOPE3 = [
  "https://www.googleapis.com/auth/gmail.send",
  "email",
  "openid",
];

type MailAuthState = {
  userId: string;
  successRedirect?: string;
  failureRedirect?: string;
};

const encodeMailAuthState = (state: MailAuthState) =>
  Buffer.from(JSON.stringify(state)).toString("base64url");

export const generateMailGoogleAuthUrl = (
  userId: string,
  options?: {
    successRedirect?: string;
    failureRedirect?: string;
    prompt?: string;
  }
) => {
  const state = encodeMailAuthState({
    userId,
    successRedirect: options?.successRedirect,
    failureRedirect: options?.failureRedirect,
  });

  return mailOAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: MAIL_SCOPE3,
    prompt: options?.prompt || "select_account",
    state,
    response_type: "code",
  });
};

export const decodeMailAuthState = (value: string): MailAuthState | null => {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};
