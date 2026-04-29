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
import {subscriptionNameToRefreshLeads} from "../../utils/services/subscriptionNameToRefreshLeads";


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
        const isGlobalAdmin = inviter.role === "admin";
        const isOrgAdminOrOwner = inviter.orgRole === "admin" || inviter.orgRole === "owner";
        const sameOrganization = inviter.organization_id === invitation.organization_id;
        if (!isGlobalAdmin && (!sameOrganization || !isOrgAdminOrOwner)) {
          logger.error(`Invitation is not valid anymore. Please contact your organization admin. ${sameOrganization}/${isGlobalAdmin}/${isOrgAdminOrOwner}`);
          return sendResponse(response, 403, "The invitation is not valid anymore. Please contact your organization admin.");
        }



        // Create the user
        const commonFields = {
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
        };
        const hashedPassword = await hashPassword(password);
        const user = await Users.create({
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
        });

      const org = (invitation as any).organization;
      const needsAdminPref =
        org == null ||
        org.ICP === undefined ||
        org.ICP === null ||
        org.BP === undefined ||
        org.BP === null ||
        org.territories === undefined ||
        org.territories === null;

        let adminCustomerPref: any | null = null;
        if (needsAdminPref) {
          adminCustomerPref = await CustomerPref.findOne({
            where: { userId: invitation.inviter_id },
          });
          // if admin pref is missing and org didn't provide values, fallback to nulls (or defaults)
        }

        // Compute final preference values preferring org values, then admin prefs, then null/default
        const finalICP = (org && org.ICP != null) ? org.ICP : adminCustomerPref?.ICP ?? null;
        const finalBP = (org && org.BP != null) ? org.BP : adminCustomerPref?.BP ?? null;
        const finalTerritories = (org && org.territories != null) ? org.territories : adminCustomerPref?.territories ?? null;

        await CustomerPref.create({
            id: v4(),
            userId: user.id,
            ICP: finalICP,
            BP: finalBP,
            territories: finalTerritories,
            refreshLeads: subscriptionNameToRefreshLeads[
              invitation.organization?.plan || "free"] || 100
        });
        await createDeal(user.id);

        // Mark invitation as accepted
        await invitation.update({ status: "accepted" });

        step2LeadGen(user.id, 10).catch((err: any) => {
            logger.error(err, "step2LeadGen error after accepting invite");
        });

        const rawUser = typeof (user as any).toJSON === "function" ? (user as any).toJSON() : user;
        const { password: _password, ...sanitizedUser } = rawUser;

        return sendResponse(response, 200, "Invitation accepted. Account created.", { user: sanitizedUser });
    } catch (error: any) {
        logger.error(error, "Accept Invite Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};