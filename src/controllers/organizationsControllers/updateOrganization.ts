import { Request, Response } from "express";
import Organizations from "../../models/Organizations";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";

export const updateOrganization = async (
    request: Request,
    response: Response
) => {
    try {
        const { organization_id } = request.params;
        const userId = request.user?.id;
        const {
            name,
            website,
            address,
            country,
            city,
            plan,
            subscriptionStartDate,
            subscriptionEndDate,
            basicModules,
            imModule,
            demoAccount,
        } = request.body;

        if (!userId) {
            return sendResponse(response, 401, "Unauthorized");
        }

        if (!organization_id) {
            return sendResponse(response, 400, "Organization ID is required");
        }

        // Check if user is part of the organization and is owner/admin
        const membership = await Users.findOne({
            where: {
                id: userId,
                organization_id: organization_id,
                orgRole: ["owner", "admin"], // Adjust field/values as per your schema
            },
        });

        if (!membership) {
            return sendResponse(response, 403, "Forbidden: insufficient permissions");
        }

        const organization = await Organizations.findOne({
            where: { organization_id },
        });

        if (!organization) {
            return sendResponse(response, 404, "Organization not found");
        }

        // Update only the fields that are provided
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (website !== undefined) updateData.website = website;
        if (address !== undefined) updateData.address = address;
        if (country !== undefined) updateData.country = country;
        if (city !== undefined) updateData.city = city;
        if (plan !== undefined) updateData.plan = plan;
        if (subscriptionStartDate !== undefined)
            updateData.subscriptionStartDate = subscriptionStartDate;
        if (subscriptionEndDate !== undefined)
            updateData.subscriptionEndDate = subscriptionEndDate;
        if (basicModules !== undefined)
          updateData.basicModules = basicModules;
        if (imModule !== undefined)
          updateData.imModule = imModule;
        if (demoAccount !== undefined)
          updateData.demoAccount = demoAccount;

        await organization.update(updateData);

        return sendResponse(response, 200, "Organization updated successfully", {
            organization,
        });
    } catch (error: any) {
        logger.error(error, "Update Organization Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};