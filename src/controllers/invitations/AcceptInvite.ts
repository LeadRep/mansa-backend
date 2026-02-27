import { Request, Response } from "express";
import Users, {userRole} from "../../models/Users";
import Invitations from "../../models/Invitations";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { v4 } from "uuid";
import {hashPassword} from "../../utils/services/password";
import {CustomerPref} from "../../models/CustomerPref";
import {createDeal} from "../usersControllers/deals/createDeal";
import {step2LeadGen} from "../leadsController/step2LeadGen";
import Organizations from "../../models/Organizations";
import { database } from "../../configs/database/database";


export const AcceptInvite = async (request: Request, response: Response) => {
    try {
        const { token, password, firstName, lastName } = request.body;
        if (!token || !password) {
            return sendResponse(response, 400, "Token and password are required");
        }
      if (!firstName || !lastName) {
        return sendResponse(response, 400, "firstName and lastName are required");
      }

        if (typeof password !== "string" || password.length < 4) {
            return sendResponse(response, 400, "Password must be at least 4 characters long");
        }
        // Find the invitation
        const invitation = await Invitations.findOne({
            where: { token, status: "pending" },
            include: [
              {
                model: Organizations,
                as: "organization",
                attributes: ['name', 'organization_id'] // Specify which fields you want
              }
            ]
        });

        if (!invitation) {
            return sendResponse(response, 404, "Invalid or expired invitation");
        }

        // Check if user already exists
        const existingUser = await Users.findOne({
            where: { email: invitation.email, organization_id: invitation.organization_id }
        });

        if (existingUser) {
            return sendResponse(response, 409, "User already exists");
        }

        const inviter = await Users.findOne({
            where: { id: invitation.inviter_id }
        });

        if (!inviter) {
            return sendResponse(response, 409, "Your inviter is not part of the organization anymore");
        }
        if (inviter.role !== "admin" &&
          (inviter.orgRole != "admin" && inviter.orgRole != "owner") &&
          inviter.organization_id !== invitation.organization_id) {
          return sendResponse(response, 403, "The invitation is not valid anymore. Please contact your organization admin.");
        }

        // Validate preconditions before any writes
        const adminCustomerPref = await CustomerPref.findOne({
          where: { userId: invitation.inviter_id }
        });
        if (!adminCustomerPref) {
          return sendResponse(response, 400, "Admin customer pref not found");
        }

        const hashedPassword = await hashPassword(password);

        // Wrap all writes in a transaction so the system stays consistent
        const user = await database.transaction(async (t) => {
            const newUser = await Users.create({
                id: v4(),
                userName: request.body.userName || null,
                phone: request.body.phone,
                picture: request.body.picture || null,
                companyName: invitation.organization?.name,
                website: invitation.organization?.website || null,
                address: invitation.organization?.address || null,
                country: invitation.organization?.country || null,
                city: invitation.organization?.city || null,
                role: userRole.USER,
                orgRole: invitation.role || "member",
                isBlocked: null,
                organization_id: invitation.organization_id,
                email: invitation.email.toLowerCase(),
                firstName: firstName || invitation.firstName,
                lastName: lastName || invitation.lastName,
                password: hashedPassword,
                isVerified: true
            }, { transaction: t });

            await CustomerPref.create({
                id: v4(),
                userId: newUser.id,
                ICP: adminCustomerPref.ICP,
                BP: adminCustomerPref.BP,
                territories: adminCustomerPref.territories
            }, { transaction: t });

            await createDeal(newUser.id, t);

            // Mark invitation as accepted
            await invitation.update({ status: "accepted" }, { transaction: t });

            return newUser;
        });

        step2LeadGen(user.id, 10).catch((err: any) => {
            logger.error(err, "step2LeadGen error after accepting invite");
        });

        return sendResponse(response, 200, "Invitation accepted. Account created.", { user });
    } catch (error: any) {
        logger.error(error, "Accept Invite Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};