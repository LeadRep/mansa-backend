import axios from "axios";

const CLIENT_ID = process.env.CONTACT_MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.CONTACT_MICROSOFT_CLIENT_SECRET!;
const REDIRECT_URI = process.env.CONTACT_MICROSOFT_REDIRECT_URI!;

export const MICROSOFT_FRONTEND_SUCCESS_URL =
    process.env.CONTACT_MICROSOFT_FRONTEND_SUCCESS_URL ||
    `${process.env.APP_DOMAIN}/contacts?microsoft_auth_status=success`;

export const MICROSOFT_FRONTEND_FAILURE_URL =
    process.env.CONTACT_MICROSOFT_FRONTEND_FAILURE_URL ||
    `${process.env.APP_DOMAIN}/contacts?microsoft_auth_status=error`;

export const MICROSOFT_MAIL_SEND_SCOPE = [
    "https://graph.microsoft.com/Mail.Send",
    "https://graph.microsoft.com/User.Read",
    "offline_access",
    "openid",
    "email",
];

type MicrosoftAuthState = {
    userId: string;
    successRedirect?: string;
    failureRedirect?: string;
    emailData?: {
        to: string;
        subject: string;
        body: string;
    };
};

export const encodeMicrosoftAuthState = (state: MicrosoftAuthState) =>
    Buffer.from(JSON.stringify(state)).toString("base64url");

export const decodeMicrosoftAuthState = (value: string): MicrosoftAuthState | null => {
    try {
        return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    } catch {
        return null;
    }
};

export const generateMicrosoftAuthUrl = (
    userId: string,
    options?: { successRedirect?: string; failureRedirect?: string; emailData?: { to: string; subject: string; body: string } }
): string => {
    const state = encodeMicrosoftAuthState({
        userId,
        successRedirect: options?.successRedirect,
        failureRedirect: options?.failureRedirect,
        emailData: options?.emailData,
    });

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: MICROSOFT_MAIL_SEND_SCOPE.join(" "),
        state,
        prompt: "select_account",
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
};

export const exchangeCodeForTokens = async (code: string) => {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
    });

    const response = await axios.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data as {
        access_token: string;
        refresh_token?: string;
        id_token?: string;
        token_type: string;
        expires_in: number;
    };
};

export const refreshAccessToken = async (refreshToken: string) => {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        redirect_uri: REDIRECT_URI,
        grant_type: "refresh_token",
        scope: MICROSOFT_MAIL_SEND_SCOPE.join(" "),
    });

    const response = await axios.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
    };
};

export const sendEmailViaGraph = async (
    accessToken: string,
    to: string,
    subject: string,
    body: string
) => {
    try {
        const response = await axios.post(
            "https://graph.microsoft.com/v1.0/me/sendMail",
            {
                message: {
                    subject,
                    body: { contentType: "Text", content: body },
                    toRecipients: [{ emailAddress: { address: to } }],
                },
                saveToSentItems: true,
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );
        console.log("sendEmailViaGraph response status:", response.status);
        return response;
    } catch (error: any) {
        console.error("sendEmailViaGraph error response:", error.response?.status, error.response?.data);
        const errorData = error.response?.data || {};
        const errorMsg = errorData.error?.message || error.message || "Unknown error";
        throw new Error(`Graph API error: ${errorMsg}`);
    }
};

export const getMicrosoftUserProfile = async (accessToken: string) => {
    const response = await axios.get("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data as {
        id: string;
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
    };
};
