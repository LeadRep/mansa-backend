import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import Users from "../../models/Users";
import { Leads, LeadStatus } from "../../models/Leads";
import logger from "../../logger";
import { step2LeadGen } from "../leadsController/step2LeadGen";

export const refreshLeads = async (request: JwtPayload, response: Response) => {
  const userId = request.user.id;
  try {
    const removeLimit =process.env.SKIP_LEADS_REFRESH_LIMIT

    const customer = await CustomerPref.findOne({ where: { userId } });
    if (!customer) {
      sendResponse(response, 404, "Customer preferences not found");
      return;
    }

    const user = await Users.findByPk(userId);
    const hasSubscription = Boolean(user?.subscriptionName);
    if (!removeLimit && !hasSubscription) {
      sendResponse(
        response,
        400,
        "You need to have a subscription to refresh leads"
      );
      return;
    }
    if (!removeLimit && customer.refreshLeads  < 1) {
      sendResponse(
        response,
        400,
        "You have used up your 5 refresh for today"
      );
      return;
    }
    if (
      !removeLimit &&
      (customer.refreshLeads) > 1 &&
      customer.nextRefresh &&
      new Date(customer.nextRefresh) > new Date()
    ) {
      const formattedDate = new Date(customer.nextRefresh).toLocaleString(
        "en-US",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZoneName: "short",
        }
      );
      sendResponse(
        response,
        400,
        `Your next refresh available at ${formattedDate}`
      );
      return;
    }
    
    const targetLeadCount = hasSubscription ? 20 : 10;

    const currentRefreshAllowance = customer.refreshLeads;
    let updatedRefreshAllowance = currentRefreshAllowance;
    let nextRefresh: Date | undefined = customer.nextRefresh || undefined;

    if (!removeLimit) {
      if (currentRefreshAllowance > 1) {
        updatedRefreshAllowance = currentRefreshAllowance - 1;
        nextRefresh = new Date(Date.now() + 3600000); // 1 hour later
      } else {
        // Reset allowance for the next day at 00:01
        updatedRefreshAllowance = 5;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 1, 0, 0);
        nextRefresh = tomorrow;
      }
    }

    await customer.update({
      refreshLeads: updatedRefreshAllowance,
      nextRefresh: nextRefresh ?? undefined,
      leadsGenerationStatus: LeadsGenerationStatus.NOT_STARTED,
    });
    logger.info("Updating existing leads to viewed");
    await Leads.update(
      { status: LeadStatus.VIEWED },
      {
        where: { owner_id: userId, status: LeadStatus.NEW },
      }
    );
    sendResponse(response, 200, "Leads refresh in progress");
    try {
      await step2LeadGen(userId, targetLeadCount);
    } catch (generationError: any) {
      logger.error(generationError, "Error triggering lead refresh");
    }
    return;
  } catch (error: any) {
    logger.error(error, "Error in refreshLeads controller:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
