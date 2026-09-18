import axios from "axios";
import crypto from "crypto";
import { Op } from "sequelize";
import { Request, Response } from "express";
import { CustomerPref } from "../../../models/CustomerPref";
import { Leads } from "../../../models/Leads";
import logger from "../../../logger";
import sendResponse from "../../../utils/http/sendResponse";
import {
  getAppSettingsObject,
  getLemlistConfig,
} from "../../../utils/lemlistIntegrationState";

const LEMLIST_API_BASE = "https://api.lemlist.com/api";

const getEncryptionKey = (): Buffer => {
  const envValue =
    process.env.LEMLIST_ENCRYPTION_KEY || "";

  return crypto.createHash("sha256").update(envValue).digest();
};

const decryptSecret = (cipherText: string): string => {
  const raw = Buffer.from(cipherText, "base64");
  const iv = raw.subarray(0, 16);
  const tag = raw.subarray(16, 32);
  const encrypted = raw.subarray(32);

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

const getLemlistAuthHeader = (apiKey: string) =>
  `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}`;

const getUpstreamErrorDetails = (error: any) => {
  const status = error?.response?.status as number | undefined;
  const data = error?.response?.data;
  const messageFromData =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.detail === "string" && data.detail) ||
    null;

  const message =
    messageFromData ||
    (typeof error?.message === "string" ? error.message : null) ||
    "Request to Lemlist failed";

  return { status, data, message };
};

const isValidHttpUrl = (value?: string | null) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const toLemlistLeadPayload = (lead: any) => {
  const organization = lead.organization || {};
  const fullName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Lead";
  const firstName = lead.first_name || fullName.split(" ")[0] || "";
  const lastName = lead.last_name || fullName.split(" ").slice(1).join(" ") || "";
  const website = organization.website_url || lead.website || "";
  const companyName = organization.name || "";
  const companyDomain = website
    ? (() => {
        try {
          return new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })()
    : "";

  const payload: Record<string, string> = {
    firstName,
    lastName,
    email: lead.email || "",
    companyName,
    jobTitle: lead.title || "",
    linkedinUrl: isValidHttpUrl(lead.linkedin_url) ? lead.linkedin_url : "",
    phone: lead.phone || "",
    companyDomain: companyDomain || "",
    website: isValidHttpUrl(website) ? website : "",
    timezone: lead.timezone || "",
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
      delete payload[key];
    }
  });

  return payload;
};

const toLemlistFallbackPayload = (lead: any) => {
  const organization = lead.organization || {};
  const fullName = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Lead";
  const firstName = lead.first_name || fullName.split(" ")[0] || "";
  const lastName = lead.last_name || fullName.split(" ").slice(1).join(" ") || "";

  const payload: Record<string, string> = {
    firstName,
    lastName,
    email: lead.email || "",
    companyName: organization.name || "",
    jobTitle: lead.title || "",
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
      delete payload[key];
    }
  });

  return payload;
};

const queueLeadToLemlist = async (campaignId: string, authHeader: string, lead: any) => {
  const primaryPayload = toLemlistLeadPayload(lead);

  try {
    return await axios.post(`${LEMLIST_API_BASE}/campaigns/${campaignId}/leads`, primaryPayload, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });
  } catch (error: any) {
    const status = error?.response?.status;
    if (status !== 400) {
      throw error;
    }

    logger.warn(
      {
        leadId: lead?.id,
        email: lead?.email,
        primaryPayload,
      },
      "Lemlist rejected enriched payload, retrying with fallback payload"
    );

    const fallbackPayload = toLemlistFallbackPayload(lead);

    return axios.post(`${LEMLIST_API_BASE}/campaigns/${campaignId}/leads`, fallbackPayload, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });
  }
};

export const listLemlistCampaigns = async (request: Request, response: Response) => {
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

    const lemlistConfig = getLemlistConfig(customerPref);

    logger.info({ provider: lemlistConfig?.provider, connected: lemlistConfig?.connected }, "Lemlist config loaded");

    if (lemlistConfig?.connected === true && !lemlistConfig?.apiKeyEncrypted) {
      logger.warn("Lemlist flagged as connected but apiKeyEncrypted is missing. Reconnect required.");
      sendResponse(
        response,
        409,
        "Lemlist connection is incomplete. Please reconnect your Lemlist account in Settings."
      );
      return;
    }

    if (lemlistConfig?.connected !== true) {
      sendResponse(response, 400, "Lemlist is not connected. Please connect it in Settings first.");
      return;
    }

    const apiKey = decryptSecret(lemlistConfig.apiKeyEncrypted);
    const authHeader = getLemlistAuthHeader(apiKey);

    const campaignsResponse = await axios.get(`${LEMLIST_API_BASE}/campaigns?limit=100`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      timeout: 20000,
    });

    const campaigns = Array.isArray(campaignsResponse.data)
      ? campaignsResponse.data
      : Array.isArray(campaignsResponse.data?.data)
        ? campaignsResponse.data.data
        : Array.isArray(campaignsResponse.data?.items)
          ? campaignsResponse.data.items
          : [];

    sendResponse(response, 200, "Lemlist campaigns loaded", { campaigns });
    return;
  } catch (error: any) {
    logger.error(error, "Error listing Lemlist campaigns:");
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to load Lemlist campaigns";

    sendResponse(response, 502, message, null);
    return;
  }
};

export const sendLeadsToLemlist = async (request: Request, response: Response) => {
  const user: any = (request as any).user;
  const userId = user?.id;
  const { leadIds, campaignId, campaignName, createNewCampaign = false } = request.body ?? {};

  if (!userId) {
    sendResponse(response, 401, "Authentication required");
    return;
  }

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    sendResponse(response, 400, "Please select at least one lead");
    return;
  }

  const uniqueLeadIds = Array.from(
    new Set(
      leadIds
        .map((leadId: any) => String(leadId ?? "").trim())
        .filter((leadId: string) => Boolean(leadId))
    )
  );

  try {
    const customerPref = await CustomerPref.findOne({ where: { userId } });
    if (!customerPref) {
      sendResponse(response, 404, "Customer preferences not found");
      return;
    }

    const lemlistConfig = getLemlistConfig(customerPref);

    if (lemlistConfig?.connected === true && !lemlistConfig?.apiKeyEncrypted) {
      logger.warn("Lemlist flagged as connected but apiKeyEncrypted is missing. Reconnect required.");
      sendResponse(
        response,
        409,
        "Lemlist connection is incomplete. Please reconnect your Lemlist account in Settings."
      );
      return;
    }

    if (lemlistConfig?.connected !== true) {
      sendResponse(response, 400, "Lemlist is not connected. Please connect it in Settings first.");
      return;
    }

    const ownedLeads = await Leads.findAll({
      where: {
        id: { [Op.in]: uniqueLeadIds },
        owner_id: userId,
      },
    });

    if (ownedLeads.length !== uniqueLeadIds.length) {
      sendResponse(response, 403, "You can only queue leads that belong to your account");
      return;
    }

    const uniqueEmailLeads = ownedLeads
      .map((lead) => lead.get({ plain: true }))
      .filter((lead) => Boolean(lead.email && String(lead.email).includes("@")))
      .reduce((acc: any[], lead: any) => {
        const normalizedEmail = String(lead.email).trim().toLowerCase();
        if (!normalizedEmail) {
          return acc;
        }

        if (acc.some((item) => String(item.email).trim().toLowerCase() === normalizedEmail)) {
          return acc;
        }

        acc.push(lead);
        return acc;
      }, []);

    if (uniqueEmailLeads.length === 0) {
      sendResponse(response, 400, "No valid lead emails were found to queue into Lemlist.");
      return;
    }

    const apiKey = decryptSecret(lemlistConfig.apiKeyEncrypted);
    const authHeader = getLemlistAuthHeader(apiKey);

    let resolvedCampaignId: string | null = String(campaignId ?? "").trim() || null;
    let resolvedCampaignName = String(campaignName || "").trim();
    let campaignResponse: any = null;

    if (!resolvedCampaignId && !createNewCampaign) {
      sendResponse(
        response,
        400,
        "Please select an existing Lemlist campaign or choose to create a new one."
      );
      return;
    }

    if (!resolvedCampaignId) {
      const name = (campaignName || `LeadRep campaign ${new Date().toISOString().slice(0, 10)}`).trim();
      campaignResponse = await axios.post(
        `${LEMLIST_API_BASE}/campaigns`,
        { name },
        {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      resolvedCampaignId =
        campaignResponse.data?._id ||
        campaignResponse.data?.id ||
        campaignResponse.data?.data?._id ||
        campaignResponse.data?.data?.id ||
        null;

      resolvedCampaignName = name;
    }

    if (!resolvedCampaignId) {
      throw new Error("Lemlist did not return a campaign id");
    }

    const queuedLeadResults = await Promise.allSettled(
      uniqueEmailLeads.map(async (lead) => queueLeadToLemlist(resolvedCampaignId, authHeader, lead))
    );

    const successfulQueues = queuedLeadResults.filter(
      (item): item is PromiseFulfilledResult<any> => item.status === "fulfilled"
    );
    const failedQueues = queuedLeadResults
      .filter((item): item is PromiseRejectedResult => item.status === "rejected")
      .map((item) => {
        const details = getUpstreamErrorDetails(item.reason);
        return {
          status: details.status ?? null,
          message: details.message,
        };
      });

    if (successfulQueues.length === 0) {
      const firstFailure = failedQueues[0];
      const failureStatus =
        firstFailure?.status && firstFailure.status >= 400 && firstFailure.status < 500
          ? firstFailure.status
          : 502;

      sendResponse(
        response,
        failureStatus,
        firstFailure?.message || "Failed to queue leads to Lemlist",
        {
          provider: "lemlist",
          campaignId: resolvedCampaignId,
          campaignName: resolvedCampaignName,
          leadCount: 0,
          failedCount: failedQueues.length,
          failures: failedQueues.slice(0, 5),
        }
      );
      return;
    }

    const result = {
      provider: "lemlist",
      status: "queued",
      queuedAt: new Date().toISOString(),
      campaignName: resolvedCampaignName,
      campaignId: resolvedCampaignId,
      leadCount: successfulQueues.length,
      failedCount: failedQueues.length,
      failures: failedQueues.slice(0, 5),
      data: {
        campaign: campaignResponse?.data ?? { _id: resolvedCampaignId, name: resolvedCampaignName },
        leads: successfulQueues.map((item) => item.value.data),
      },
    };

    const appSettings = getAppSettingsObject(customerPref.appSettings);

    const integrations = {
      ...(appSettings.integrations ?? {}),
    };

    integrations.lemlist = {
      ...(integrations.lemlist ?? {}),
      ...result,
      connected: true,
      status: "connected",
    };

    appSettings.integrations = integrations;
    await customerPref.update({ appSettings: appSettings as any });

    const responseMessage =
      failedQueues.length > 0
        ? `${successfulQueues.length} lead(s) queued. ${failedQueues.length} lead(s) failed.`
        : "Campaign queued successfully";

    sendResponse(response, 200, responseMessage, result);
    return;
  } catch (error: any) {
    logger.error(error, "Error queuing Lemlist campaign:");
    const details = getUpstreamErrorDetails(error);
    const status =
      details.status && details.status >= 400 && details.status < 500
        ? details.status
        : 502;

    sendResponse(response, status, details.message || "Failed to queue Lemlist campaign", null);
    return;
  }
};
