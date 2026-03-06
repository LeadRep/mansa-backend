import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";
import Invitations from "../../models/Invitations";
import {sendInviteEmail} from "../organizationsControllers/inviteUser";
import Organizations from "../../models/Organizations";
import crypto from "crypto";
import {v4} from "uuid";

export const adminInviteUser = async (request: Request, response: Response) => {
  try {
    const adminUserId = request.user?.id;
    const { email, firstName, lastName, role, organization_id } = request.body;
    const normalizeEmail = email?.trim().toLowerCase();

    logger.info(
      {
        organization_id,
        email: normalizeEmail,
        role,
        adminUserId
      },
      "adminInviteUser request received"
    );

    // Validate required fields
    if (!organization_id || !email || !firstName || !lastName || !role) {
      return sendResponse(response, 400, "Organization ID, email, firstName, lastName, and role are required");
    }

    // Validate role
    if (!['member', 'admin'].includes(role)) {
      return sendResponse(response, 400, "Role must be either 'member' or 'admin'");
    }

    // Check if the requesting user is an admin (assuming you have admin role check)
    const adminUser = await Users.findOne({
      where: { id: adminUserId }
    });

    if (!adminUser || adminUser.role !== 'admin') {
      return sendResponse(response, 403, "Only system admins can invite users to organizations");
    }

    // Check if organization exists
    const organization = await Organizations.findOne({
      where: { organization_id: organization_id }
    });

    if (!organization) {
      return sendResponse(response, 404, "Organization not found");
    }

    // Check if user already exists in the organization
    const existing = await Users.findOne({
      where: { email: normalizeEmail, organization_id }
    });

    if (existing) {
      return sendResponse(response, 409, "User is already a member of this organization");
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString("hex");

    // Check for existing pending invitation
    const existingInvite = await Invitations.findOne({
      where: {
        email: normalizeEmail,
        organization_id,
        status: "pending"
      }
    });

    if (existingInvite) {
      // Update existing invitation
      await existingInvite.update({
        token: token,
        firstName: firstName,
        lastName: lastName,
        role: role,
        inviter_id: adminUserId,
        status: "pending",
      });
      logger.info(`Updated existing invitation for ${normalizeEmail} to organization ${organization_id}`);
    } else {
      // Create new invitation
      await Invitations.create({
        invitation_id: v4(),
        organization_id: organization_id,
        email: normalizeEmail,
        firstName: firstName,
        lastName: lastName,
        role: role,
        inviter_id: adminUserId,
        token: token,
        status: "pending"
      });
      logger.info(`Created new invitation for ${normalizeEmail} to organization ${organization_id}`);
    }

    // Send invitation email
    const inviteLink = `${process.env.APP_DOMAIN}/accept-invite?token=${token}`;
    await sendInviteEmail(organization.name, normalizeEmail, inviteLink);

    logger.info(`Invitation email sent to ${normalizeEmail} for organization ${organization.name}`);
    return sendResponse(response, 200, "Invitation sent successfully");

  } catch (error: any) {
    logger.error(error, "Admin Invite User Error:");
    return sendResponse(response, 500, "Internal Server Error");
  }
};