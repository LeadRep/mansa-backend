import { Request, Response } from "express";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Invitations from "../../models/Invitations";
import { v4 } from "uuid";
import crypto from "crypto"; // Add this import

import nodemailer from "nodemailer";
import Organizations from "../../models/Organizations";

export async function sendInviteEmail(orgName: string, to: string, inviteLink: string) {
    console.log("Sending invite email to:", to, "with link:", inviteLink);
    // const transporter = nodemailer.createTransport({
    //     service: "gmail", // or your email provider
    //     auth: {
    //         user: process.env.EMAIL_USER,
    //         pass: process.env.EMAIL_PASS,
    //     },
    // });
    //
    // await transporter.sendMail({
    //     from: process.env.EMAIL_USER,
    //     to,
    //     subject: "You're invited to join the organization",
    //     html: `
    //     <p>Hello,</p>
    //     <p>You have been invited to join <strong>Our Organization ${orgName}</strong> by one of our team members.</p>
    //     <p>To accept the invitation and get started, please click the link below:</p>
    //     <p><a href="${inviteLink}">Accept Invitation</a></p>
    //     <p>If you did not expect this invitation, you can safely ignore this email.</p>
    //     <br>
    //     <p>Best regards,<br>The Our Organization Team</p>
    // `,
    // });
}

export const inviteUser = async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;
        const { organization_id } = request.params;
        const { email, firstName, lastName, role } = request.body;
        console.log("requestBody: ", request.body)

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
        console.log(userId, organization_id, membership, organization.name, email, "membership");
        console.log(membership);
        if (!membership) {
            return sendResponse(response, 403, "Only organization owners or admins can invite users");
        }

        // Check if user already exists
        const existing = await Users.findOne({
            where: { email: email, organization_id }
        });
        if (existing) {
            return sendResponse(response, 409, "User is already a member");
        }

        const token = crypto.randomBytes(32).toString("hex");
        const existingInvite = await Invitations.findOne({
            where: {
                email,
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
                email: email,
                firstName: firstName,
                lastName: lastName,
                role: role,
                inviter_id: userId,
                token: token,
                status: "pending"
            });
        }

        const inviteLink = `${process.env.APP_DOMAIN}/accept-invite?token=${token}`;
        //await sendInviteEmail(organization.name, email, inviteLink);
        return sendResponse(response, 200, "Invitation sent successfully");
    } catch (error: any) {
        logger.error(error, "Invite User Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};