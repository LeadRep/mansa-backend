import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import { Leads, LeadStatus } from "../../models/Leads";
import Users from "../../models/Users";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import logger from "../../logger";
import { runLeadGeneration } from "../leadsController/leadGenSelector";

export const userLeads = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const expand =Boolean(req.query?.expand) || false;
    const user = await Users.findOne({ where: { id: userId } });
    const customer = await CustomerPref.findOne({ where: { userId } });

    if (!user) {
      sendResponse(res, 400, "User not found", []);
      return;
    }
    let userLeads = await Leads.findAll({
      where: { owner_id: userId, status: LeadStatus.NEW },
      order: [["createdAt", "DESC"]],
    });
    const hasSubscription = Boolean(
      user.subscriptionName || customer?.subscriptionName
    );
    const generationStatus = customer?.leadsGenerationStatus;
    const maxLeads = hasSubscription ? 20 : 10;

    if (userLeads.length > maxLeads) {
      userLeads = userLeads.slice(0, maxLeads);
    }

    const needsMoreLeads = userLeads.length < maxLeads;

    if (needsMoreLeads) {
      const message = "Currently generating leads, please wait a moment";

      const responsePayload = {
        leads: userLeads,
        needsExpansion: false,
        missingCount: maxLeads - userLeads.length,
      };

      sendResponse(res, 200, message, responsePayload);

      const shouldTriggerGeneration =
        generationStatus !== LeadsGenerationStatus.ONGOING;

      if (shouldTriggerGeneration) {
        runLeadGeneration(
          userId,
          maxLeads - userLeads.length,
          false,
          expand
        )
      }
      return;
    }

    const responsePayload = {
      leads: userLeads.slice(0, maxLeads),
      needsExpansion: false,
      missingCount: 0,
    };
    sendResponse(res, 200, "Leads gotten", responsePayload);
    return;
  } catch (error: any) {
    console.log("UserLeads error", error.message)
    logger.error(error, "Error in userLeads:");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
