import { Request, Response } from "express";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Invitations from "../../models/Invitations";
import { v4 } from "uuid";
import crypto from "crypto"; // Add this import

import Organizations from "../../models/Organizations";
import { sendEmail } from "../../configs/email/emailConfig";
import {CustomerPref} from "../../models/CustomerPref";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function sendInviteEmail(orgName: string, to: string, inviteLink: string, language: string = 'en') {
  logger.info(`Sending invite email to: ${to} with link: ${inviteLink} in language: ${language}`);

  const supportEmail = process.env.SUPPORT_EMAIL || "info@leadrep.ai";
  const expiresDays = "14";

  const safeOrgName = escapeHtml(orgName);
  const safeInviteLink = escapeHtml(encodeURI(inviteLink));
  const safeSupportEmail = escapeHtml(supportEmail);

  const html = language === 'fr' ? `
    <p>Bonjour,</p>
    <p>Vous avez été invité(e) à rejoindre l'espace de travail de <strong>${safeOrgName}</strong>.</p>
    <p>Pour accepter l'invitation et commencer, cliquez sur le bouton ci-dessous :</p>
    <p style="text-align:center;">
      <a href="${safeInviteLink}" style="display:inline-block;padding:12px 20px;background:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;">
        Accepter l'invitation
      </a>
    </p>
    <p>Si le bouton ci-dessus ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
    <p><a href="${safeInviteLink}">${safeInviteLink}</a></p>
    <p style="color:#666;font-size:13px;">
      Ce lien expire dans ${expiresDays} jours et ne peut être utilisé qu'une seule fois. Si vous n'attendiez pas cette invitation, ignorez cet email ou contactez <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a>.
    </p>
    <br>
    <p>Cordialement</p>
    <hr style="border:none;border-top:1px solid #eee;margin-top:16px;">
    <p style="color:#999;font-size:12px;">Vous recevez cet email car une invitation a été envoyée pour l'espace de travail ${safeOrgName}. Si vous pensez qu'il s'agit d'une erreur, contactez <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a>.</p>
  ` : `
    <p>Hello,</p>
    <p>You have been invited to join <strong>${safeOrgName}</strong>'s workspace.</p>
    <p>To accept the invitation and get started, click the button below:</p>
    <p style="text-align:center;">
      <a href="${safeInviteLink}" style="display:inline-block;padding:12px 20px;background:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;">
        Accept Invitation
      </a>
    </p>
    <p>If the button above does not work, copy and paste this link into your browser:</p>
    <p><a href="${safeInviteLink}">${safeInviteLink}</a></p>
    <p style="color:#666;font-size:13px;">
      This link expires in ${expiresDays} days and can only be used once. If you did not expect this invitation, ignore this email or contact <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a>.
    </p>
    <br>
    <p>Best regards</p>
    <hr style="border:none;border-top:1px solid #eee;margin-top:16px;">
    <p style="color:#999;font-size:12px;">You are receiving this email because an invitation was sent to ${safeOrgName} workspace. If you believe this is an error, contact <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a>.</p>
  `;

  const text = language === 'fr' ? [
    `Bonjour,`,
    ``,
    `Vous avez été invité(e) à rejoindre l'espace de travail de ${orgName}.`,
    ``,
    `Accepter l'invitation: ${inviteLink}`,
    ``,
    `Si le lien ci-dessus ne fonctionne pas, copiez et collez-le dans votre navigateur.`,
    ``,
    `Note: Ce lien expire dans ${expiresDays} jours et ne peut être utilisé qu'une seule fois.`,
    `Si vous n'attendiez pas cette invitation, ignorez cet email ou contactez ${supportEmail}.`,
    ``,
    `Cordialement,`
  ].join('\n') : [
    `Hello,`,
    ``,
    `You have been invited to join ${orgName}'s workspace.`,
    ``,
    `Accept invitation: ${inviteLink}`,
    ``,
    `If the link above does not work, copy and paste it into your browser.`,
    ``,
    `Note: This link expires in ${expiresDays} days and can only be used once.`,
    `If you did not expect this invitation, ignore this email or contact ${supportEmail}.`,
    ``,
    `Best regards,`
  ].join('\n');

  const subject = language === 'fr' ?
    "Vous êtes invité(e) à rejoindre l'organisation" :
    "You're invited to join the organization";

  await sendEmail(
    to,
    subject,
    text,
    html
  );
}


export const inviteUser = async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;
        const { organization_id } = request.params;
        const { email, firstName, lastName, role } = request.body;
        const normalizeEmail = email?.trim().toLowerCase();
        logger.info(
            {
                organization_id,
                email: normalizeEmail,
                role,
            },
            "inviteUser request received"
        );

        if (!organization_id || !email) {
            return sendResponse(response, 400, "Organization ID and email are required");
        }

        const organization = await Organizations.findOne({
            where: { organization_id: organization_id }
        })

        if (!organization) {
            return sendResponse(response, 400, "Organization not found");
        }

        // Check if caller is owner or admin
        const membership = await Users.findOne({
            where: { id: userId, organization_id, orgRole: ["owner", "admin"] }
        });
        logger.debug(userId, organization_id, membership, organization.name, email, "membership");
        logger.debug(membership);
        if (!membership) {
            return sendResponse(response, 403, "Only organization owners or admins can invite users");
        }

        const inviterPref = await CustomerPref.findOne({
          where: {
            userId: userId
          }
        })

      const preferredLanguage = inviterPref?.appSettings?.preferredLanguage || 'en';


      // Check if user already exists
        const existing = await Users.findOne({
            where: { email: normalizeEmail, organization_id }
        });
        if (existing) {
            return sendResponse(response, 409, "User is already a member");
        }

        const token = crypto.randomBytes(32).toString("hex");
        const existingInvite = await Invitations.findOne({
            where: {
                email: normalizeEmail,
                organization_id,
                status: "pending"
            }
        });
        if (existingInvite) {
            await existingInvite.update({
                token: token,
                inviter_id: userId,
                status: "pending"
                // Add other fields to update if needed
            });
        } else {
            await Invitations.create({
                invitation_id: v4(),
                organization_id: organization_id,
                email: normalizeEmail,
                firstName: firstName,
                lastName: lastName,
                role: role,
                inviter_id: userId,
                token: token,
                status: "pending"
            });
        }

        const inviteLink = `${process.env.APP_DOMAIN}/accept-invite?token=${token}`;
        await sendInviteEmail(organization.name, normalizeEmail, inviteLink, preferredLanguage);
        return sendResponse(response, 200, "Invitation sent successfully");
    } catch (error: any) {
        logger.error(error, "Invite User Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};