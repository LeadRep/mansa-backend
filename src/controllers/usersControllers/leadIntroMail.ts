import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { Leads } from "../../models/Leads";
import { CustomerPref } from "../../models/CustomerPref";
import Users from "../../models/Users";
import { generateMailGoogleAuthUrl } from "./contacts/google/googleMailConfig";
import { generateMicrosoftAuthUrl } from "./contacts/microsoft/microsoftConfig";
import {
  generateIntroMailForLead,
  normalizeIntroMail,
  type IntroMailTone,
} from "../leadsController/introMail";

const VALID_TONES: readonly IntroMailTone[] = ["formal", "warm", "short"] as const;
const parseTone = (value: unknown): IntroMailTone | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as IntroMailTone;
  return (VALID_TONES as readonly string[]).includes(normalized) ? normalized : null;
};
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

    const tone = parseTone(req.body?.tone ?? (req.query as any)?.tone);

    // If the caller requested a specific tone, always regenerate — but do not
    // overwrite the cached default draft so subsequent default requests are fast.
    if (tone) {
      const customerPref = await CustomerPref.findOne({ where: { userId } });
      const introMail = await generateIntroMailForLead(
        customerPref,
        lead.get({ plain: true }),
        senderProfile,
        tone
      );
      sendResponse(res, 200, "Intro mail generated", {
        leadId: lead.id,
        intro_mail: introMail,
        generated: true,
        tone,
      });
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

    sendResponse(res, 200, "Google authorization required", {
      requiresGoogleAuth: true,
      authorizeUrl: generateMailGoogleAuthUrl(userId, {
        successRedirect,
        failureRedirect,
        prompt: "consent select_account",
      }),
    });
  } catch (error: any) {
    logger.error(error, "Error preparing intro mail");
    sendResponse(res, 500, "Failed to prepare intro mail", null, error.message);
  }
};

export const sendLeadIntroMailWithOutlook = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const leadId = req.params.leadId;

  if (!userId) {
    sendResponse(res, 401, "Unauthorized");
    return;
  }

  const appDomain = String(process.env.APP_DOMAIN || "").replace(/\/$/, "");
  const successRedirect = `${appDomain}/leads?microsoft_auth_status=success&outlook_action=intro_mail_send`;
  const failureRedirect = `${appDomain}/leads?microsoft_auth_status=error&outlook_action=intro_mail_send`;

  try {
    const user = await Users.findByPk(userId, {
      attributes: ["firstName", "lastName", "companyName"],
    });
    const senderProfile = {
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      companyName: user?.companyName || null,
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
      ? normalizeIntroMail(inputIntroMail, lead.get({ plain: true }), customerPref, senderProfile)
      : hasIntroMail(lead.intro_mail)
      ? normalizeIntroMail(lead.intro_mail, lead.get({ plain: true }), customerPref, senderProfile)
      : await generateIntroMailForLead(customerPref, lead.get({ plain: true }), senderProfile);

    if (!hasIntroMail(lead.intro_mail) || hasIntroMail(inputIntroMail)) {
      await lead.update({ intro_mail: introMail });
    }

    const authUrl = generateMicrosoftAuthUrl(userId, {
      successRedirect,
      failureRedirect,
      emailData: {
        to: lead.email,
        subject: introMail.subject,
        body: introMail.body,
      },
    });

    sendResponse(res, 200, "Microsoft authorization required", {
      requiresMicrosoftAuth: true,
      authorizeUrl: authUrl,
    });
  } catch (error: any) {
    logger.error(error, "Error preparing intro mail");
    sendResponse(res, 500, "Failed to prepare intro mail", null, error.message);
  }
};
