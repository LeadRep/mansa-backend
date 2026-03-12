import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import Users from "../../models/Users";
import { Leads, LeadStatus } from "../../models/Leads";
import logger from "../../logger";
import { runLeadGeneration } from "../leadsController/leadGenSelector";

export const refreshLeads = async (request: JwtPayload, response: Response) => {
  const userId = request.user.id;
  try {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");

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
    const hasSubscription = Boolean(
      user?.subscriptionName || customer?.subscriptionName
    );
    if (!skipLimit && !hasSubscription) {
      sendResponse(
        response,
        400,
        "You need to have a subscription to refresh leads"
      );
      return;
    }

    const targetLeadCount = hasSubscription ? 20 : 10;
    const currentRefreshAllowance = customer.refreshLeads ?? 0;

    if (currentRefreshAllowance < 1) {
      let msg =
        "You have used up your number of refresh for this month. Please upgrade your subscription to continue generating leads.";
      if (customer.nextRefresh && new Date(customer.nextRefresh) > new Date()) {
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
        msg = `You have used up your number of refresh for this month. The next refresh will be available on ${formattedDate} or you can upgrade your subscription to continue generating leads.`;
      }
      sendResponse(response, 400, msg);
      return;
    }

    const updatedRefreshAllowance =
      currentRefreshAllowance > 0
        ? currentRefreshAllowance - targetLeadCount
        : currentRefreshAllowance;

    await customer.update({
      refreshLeads: updatedRefreshAllowance,
      leadsGenerationStatus: LeadsGenerationStatus.NOT_STARTED,
    });

    await Leads.update(
      { status: LeadStatus.VIEWED },
      {
        where: { owner_id: userId },
      }
    );

    sendResponse(response, 200, "Currently generating leads, please wait a moment", {
      leads: [],
      needsExpansion: false,
      missingCount: 0,
    });

    runLeadGeneration(userId, targetLeadCount, true).catch(
      (generationError: any) => {
        logger.error("Lead generation error:", generationError.message);
      }
    );

    return;
  } catch (error: any) {
    logger.error(error, "Error in refreshLeads controller:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
