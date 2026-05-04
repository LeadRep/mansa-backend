import { Request, Response } from "express";
import { google } from "googleapis";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { Leads } from "../../models/Leads";
import { CustomerPref } from "../../models/CustomerPref";
import Users from "../../models/Users";
import UserLinkedAccounts, {
  LinkedAccountProvider,
} from "../../models/UserLinkedAccounts";
import UserLinkedAccountTokens, {
  TokenScope,
} from "../../models/UserLinkedAccountTokens";
import { generateGoogleAuthUrl } from "./contacts/google/googleContactsController";
import { oauth2Client, SCOPE3 } from "./contacts/google/googleConfig";
import {
  generateIntroMailForLead,
  normalizeIntroMail,
} from "../leadsController/introMail";

const isInsufficientScopeError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();
  const responseData = JSON.stringify(error?.response?.data || {}).toLowerCase();
  return (
    message.includes("insufficient authentication scopes") ||
    responseData.includes("insufficient authentication scopes")
  );
};

const toBase64Url = (value: string): string =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const getLeadByOwner = async (leadId: string, ownerId: string) =>
  Leads.findOne({ where: { id: leadId, owner_id: ownerId } });

const hasIntroMail = (introMail: any) =>
  typeof introMail?.subject === "string" &&
  introMail.subject.trim().length > 0 &&
  typeof introMail?.body === "string" &&
  introMail.body.trim().length > 0;

const hasValidRecipient = (email: string | null | undefined): boolean => {
  if (!email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === "na") {
    return false;
  }
  if (normalized === "email_not_unlocked@domain.com") {
    return false;
  }
  return normalized.includes("@");
};

export const getOrGenerateLeadIntroMail = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const leadId = req.params.leadId;

  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  try {
    const user = await Users.findByPk(userId, {
      attributes: ["firstName", "lastName", "companyName", "organization_id"],
    });
    const senderProfile = {
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      companyName: user?.companyName || null,
      companyId: user?.organization_id || null,
    };

    const lead = await getLeadByOwner(leadId, userId);
    if (!lead) {
      sendResponse(res, 404, "Lead not found");
      return;
    }

    if (hasIntroMail(lead.intro_mail)) {
      sendResponse(res, 200, "Intro mail retrieved", {
        leadId: lead.id,
        intro_mail: lead.intro_mail,
        generated: false,
      });
      return;
    }

    const customerPref = await CustomerPref.findOne({ where: { userId } });
    const introMail = await generateIntroMailForLead(
      customerPref,
      lead.get({ plain: true }),
      senderProfile
    );

    await lead.update({ intro_mail: introMail });

    sendResponse(res, 200, "Intro mail generated", {
      leadId: lead.id,
      intro_mail: introMail,
      generated: true,
    });
  } catch (error: any) {
    logger.error(error, "Error generating intro mail on-demand");
    sendResponse(res, 500, "Failed to generate intro mail", null, error.message);
  }
};

export const sendLeadIntroMailWithGmail = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const leadId = req.params.leadId;

  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  try {
    const appDomain = String(process.env.APP_DOMAIN || "").replace(/\/$/, "");
    const successRedirect = `${appDomain}/leads?google_auth_status=success&gmail_action=intro_mail_send`;
    const failureRedirect = `${appDomain}/leads?google_auth_status=error&gmail_action=intro_mail_send`;
    const user = await Users.findByPk(userId, {
      attributes: ["firstName", "lastName", "companyName"],
    });
    const senderProfile = {
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      companyName: user?.companyName || null,
      companyId: user?.organization_id || null,
    };

    const lead = await getLeadByOwner(leadId, userId);
    if (!lead) {
      sendResponse(res, 404, "Lead not found");
      return;
    }

    if (!hasValidRecipient(lead.email)) {
      sendResponse(res, 400, "Lead email is not available");
      return;
    }

    const customerPref = await CustomerPref.findOne({ where: { userId } });
    const inputIntroMail = {
      subject: req.body?.subject,
      body: req.body?.body,
    };

    let introMail = hasIntroMail(inputIntroMail)
      ? normalizeIntroMail(
          inputIntroMail,
          lead.get({ plain: true }),
          customerPref,
          senderProfile
        )
      : hasIntroMail(lead.intro_mail)
      ? normalizeIntroMail(
          lead.intro_mail,
          lead.get({ plain: true }),
          customerPref,
          senderProfile
        )
      : await generateIntroMailForLead(
          customerPref,
          lead.get({ plain: true }),
          senderProfile
        );

    if (!hasIntroMail(lead.intro_mail) || hasIntroMail(inputIntroMail)) {
      await lead.update({ intro_mail: introMail });
    }

    const linkedAccount = await UserLinkedAccounts.findOne({
      where: {
        user_id: userId,
        provider: LinkedAccountProvider.GOOGLE,
      },
      order: [["updatedAt", "DESC"]],
    });

    if (!linkedAccount) {
      sendResponse(res, 200, "Google authorization required", {
        requiresGoogleAuth: true,
        authorizeUrl: generateGoogleAuthUrl(userId, SCOPE3, {
          successRedirect,
          failureRedirect,
          prompt: "consent select_account",
        }),
      });
      return;
    }

    const tokenRecord = await UserLinkedAccountTokens.findOne({
      where: {
        user_account_id: linkedAccount.user_account_id,
        scope: TokenScope.SCOPE3,
      },
      order: [["last_used_at", "DESC"]],
    });

    if (!tokenRecord?.encrypted_refresh_token) {
      sendResponse(res, 200, "Google authorization required", {
        requiresGoogleAuth: true,
        authorizeUrl: generateGoogleAuthUrl(userId, SCOPE3, {
          successRedirect,
          failureRedirect,
          prompt: "consent select_account",
        }),
      });
      return;
    }

    oauth2Client.setCredentials({ refresh_token: tokenRecord.encrypted_refresh_token });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const emailContent = [
      `To: ${lead.email}`,
      `Subject: ${introMail.subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      introMail.body,
    ].join("\n");

    const raw = toBase64Url(emailContent);

    const sendResult = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    await tokenRecord.update({ last_used_at: new Date() });

    sendResponse(res, 200, "Intro mail sent successfully", {
      leadId: lead.id,
      intro_mail: introMail,
      gmailMessageId: sendResult.data?.id || null,
    });
  } catch (error: any) {
    if (isInsufficientScopeError(error)) {
      const linkedAccount = await UserLinkedAccounts.findOne({
        where: {
          user_id: userId,
          provider: LinkedAccountProvider.GOOGLE,
        },
        order: [["updatedAt", "DESC"]],
      });

      if (linkedAccount) {
        await UserLinkedAccountTokens.destroy({
          where: {
            user_account_id: linkedAccount.user_account_id,
            scope: TokenScope.SCOPE3,
          },
        });
      }

      const appDomain = String(process.env.APP_DOMAIN || "").replace(/\/$/, "");
      const successRedirect = `${appDomain}/leads?google_auth_status=success&gmail_action=intro_mail_send`;
      const failureRedirect = `${appDomain}/leads?google_auth_status=error&gmail_action=intro_mail_send`;
      sendResponse(res, 200, "Google authorization required", {
        requiresGoogleAuth: true,
        authorizeUrl: generateGoogleAuthUrl(userId, SCOPE3, {
          successRedirect,
          failureRedirect,
          prompt: "consent select_account",
        }),
      });
      return;
    }
    logger.error(error, "Error sending intro mail with Gmail");
    sendResponse(res, 500, "Failed to send intro mail", null, error.message);
  }
};
