import axios from "axios";
import crypto from "crypto";
import { Request, Response } from "express";
import { CustomerPref } from "../../../models/CustomerPref";
import logger from "../../../logger";
import sendResponse from "../../../utils/http/sendResponse";
import { getAppSettingsObject } from "../../../utils/lemlistIntegrationState";

const LEMLIST_API_BASE = "https://api.lemlist.com/api";

const getEncryptionKey = (): Buffer => {
  const envValue =
    process.env.LEMLIST_ENCRYPTION_KEY || "";

  return crypto.createHash("sha256").update(envValue).digest();
};

const encryptSecret = (secret: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

const validateLemlistApiKey = async (apiKey: string) => {
  const authHeader = `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}`;

  const response = await axios.get(`${LEMLIST_API_BASE}/campaigns?limit=1`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    timeout: 15000,
  });

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    data: response.data,
  };
};

const buildLemlistMetadata = (data?: any) => {
  const accountName =
    data?.account?.name ||
    data?.workspace?.name ||
    data?.data?.account?.name ||
    "Lemlist workspace";

  return {
    provider: "lemlist",
    connected: true,
    status: "connected",
    accountName,
    lastValidatedAt: new Date().toISOString(),
    note: "Your Lemlist account is connected and ready to receive lead lists.",
  };
};

export const connectLemlist = async (request: Request, response: Response) => {
  const user: any = (request as any).user;
  const userId = user?.id;

  if (!userId) {
    sendResponse(response, 401, "Authentication required");
    return;
  }

  const { apiKey } = request.body ?? {};
  const trimmedKey = String(apiKey ?? "").trim();

  if (!trimmedKey) {
    sendResponse(response, 400, "Lemlist API key is required");
    return;
  }

  try {
    const validation = await validateLemlistApiKey(trimmedKey).catch((error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return { ok: false, status: error.response.status, data: error.response.data };
      }

      throw error;
    });

    if (!validation.ok) {
      sendResponse(response, 401, "Invalid Lemlist API key");
      return;
    }

    const customerPref = await CustomerPref.findOne({ where: { userId } });
    if (!customerPref) {
      sendResponse(response, 404, "Customer preferences not found");
      return;
    }

    const appSettings = getAppSettingsObject(customerPref.appSettings);
    const integrations = {
      ...(appSettings.integrations ?? {}),
    };
    delete (appSettings as any).lemlist;
    delete (appSettings as any).Lemlist;
    delete (integrations as any).Lemlist;

    const metadata = buildLemlistMetadata(validation.data);
    const apiKeyEncrypted = encryptSecret(trimmedKey);

    integrations.lemlist = {
      ...metadata,
    };

    appSettings.integrations = integrations;

    await customerPref.update({
      appSettings: appSettings as any,
      lemlistApiKeyEncrypted: apiKeyEncrypted,
    });

    sendResponse(response, 200, "Lemlist connected successfully", {
      ...metadata,
      provider: "lemlist",
      connected: true,
    });
    return;
  } catch (error: any) {
    logger.error(error, "Error connecting Lemlist account:");
    sendResponse(
      response,
      500,
      "Unable to connect Lemlist account",
      null,
      error?.message || "Unknown error",
    );
    return;
  }
};

export const disconnectLemlist = async (request: Request, response: Response) => {
  const user: any = (request as any).user;
  const userId = user?.id;

  if (!userId) {
    sendResponse(response, 401, "Authentication required");
    return;
  }

  try {
    const customerPref = await CustomerPref.findOne({ where: { userId } });
    if (!customerPref) {
      sendResponse(response, 404, "Customer preferences not found");
      return;
    }

    const appSettings = getAppSettingsObject(customerPref.appSettings);
    const integrations = {
      ...(appSettings.integrations ?? {}),
    };
    delete (appSettings as any).lemlist;
    delete (appSettings as any).Lemlist;
    delete (integrations as any).Lemlist;

    integrations.lemlist = {
      provider: "lemlist",
      connected: false,
      status: "disconnected",
      lastValidatedAt: null,
      accountName: null,
      note: "Lemlist is disconnected. Connect a new API key when ready.",
    };

    appSettings.integrations = integrations;
    await customerPref.update({
      appSettings: appSettings as any,
      lemlistApiKeyEncrypted: null,
    });

    sendResponse(response, 200, "Lemlist disconnected successfully", {
      provider: "lemlist",
      connected: false,
      status: "disconnected",
    });
    return;
  } catch (error: any) {
    logger.error(error, "Error disconnecting Lemlist account:");
    sendResponse(response, 500, "Unable to disconnect Lemlist account", null);
    return;
  }
};
