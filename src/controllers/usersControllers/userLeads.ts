import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import { Leads } from "../../models/Leads";
import Users from "../../models/Users";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import logger from "../../logger";
import { step2LeadGen } from "../leadsController/step2LeadGen";

export const userLeads = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const user = await Users.findOne({ where: { id: userId } });
    const customer = await CustomerPref.findOne({ where: { userId } });

    if (!user) {
      sendResponse(res, 400, "User not found", []);
      return;
    }
    const userLeads = await Leads.findAll({ where: { owner_id: userId } });
    console.log("Total leads for user:", userLeads.length);
    const hasSubscription = Boolean(user.subscriptionName);
    const generationStatus = customer?.leadsGenerationStatus;
    const maxLeads = hasSubscription ? 20 : 10;
    const needsMoreLeads = userLeads.length < maxLeads;

    if (needsMoreLeads) {
      const message =
        generationStatus === LeadsGenerationStatus.COMPLETED &&
        userLeads.length === 0
          ? "No lead found, please update buyer persona"
          : "Currently generating leads, please wait a moment";

      sendResponse(
        res,
        200,
        message,
        userLeads
      );

      const shouldTriggerGeneration =
        generationStatus === LeadsGenerationStatus.FAILED ||
        generationStatus === LeadsGenerationStatus.NOT_STARTED;

      if (shouldTriggerGeneration) {
        await step2LeadGen(
          userId,
          maxLeads - userLeads.length,
          generationStatus === LeadsGenerationStatus.FAILED ||
            generationStatus === LeadsGenerationStatus.NOT_STARTED
        );
      }
      return;
    }

    sendResponse(res, 200, "Leads gotten", userLeads.slice(0, maxLeads));
    return;
  } catch (error: any) {
    logger.error(error, "Error in userLeads:");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
