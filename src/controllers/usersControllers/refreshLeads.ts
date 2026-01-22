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
    const skipLimit =
      String(process.env.SKIP_LEADS_REFRESH_LIMIT ?? "")
        .trim()
        .toLowerCase() === "true";

    const customer = await CustomerPref.findOne({ where: { userId } });
    if (!customer) {
      sendResponse(response, 404, "Customer preferences not found");
      return;
    }

    const user = await Users.findByPk(userId);
    const hasSubscription = Boolean(user?.subscriptionName);
    if (!skipLimit && !hasSubscription) {
      sendResponse(
        response,
        400,
        "You need to have a subscription to refresh leads"
      );
      return;
    }

    const currentRefreshAllowance = customer.refreshLeads ?? 0;
    if (!skipLimit && currentRefreshAllowance < 1) {
      sendResponse(
        response,
        400,
        "You have used up your number of refresh for today"
      );
      return;
    }

    if (
      !skipLimit &&
      currentRefreshAllowance > 1 &&
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
        `Your next refresh is available at ${formattedDate}`
      );
      return;
    }

    const targetLeadCount = hasSubscription ? 20 : 10;

    let updatedRefreshAllowance = currentRefreshAllowance;
    let nextRefresh: Date | undefined = customer.nextRefresh || undefined;

    if (!skipLimit) {
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

    let generationOutcome: any = null;
    try {
      generationOutcome = await step2LeadGen(userId, targetLeadCount);
    } catch (generationError: any) {
      logger.error("Lead generation error:", generationError.message);
    }

    const generatedLeads = Array.isArray(generationOutcome)
      ? generationOutcome
      : Array.isArray(generationOutcome?.leads)
      ? generationOutcome.leads
      : [];

    const message =
      (generationOutcome &&
      typeof generationOutcome?.message === "string"
        ? generationOutcome.message
        : undefined) ||
      (generatedLeads.length
        ? "Leads refreshed successfully!"
        : "No lead found, please update buyer persona");

    const latestLeads =
      generatedLeads.length > 0
        ? generatedLeads
        : await Leads.findAll({
            where: { owner_id: userId, status: LeadStatus.NEW },
            limit: targetLeadCount,
          });

    sendResponse(response, 200, message, latestLeads);
    return;
  } catch (error: any) {
    logger.error(error, "Error in refreshLeads controller:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
