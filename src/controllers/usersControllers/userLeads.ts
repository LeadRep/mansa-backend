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

    if (!user.subscriptionName) {
      if (userLeads.length < 10) {
        sendResponse(
          res,
          200,
          "Currently generating leads, please wait a moment",
          userLeads
        );
        
        if (
          customer?.leadsGenerationStatus === LeadsGenerationStatus.COMPLETED
        ) {
          await step2LeadGen(userId, 10 - userLeads.length);
        }
        return;
      }
      sendResponse(res, 200, "Leads gotten", userLeads.slice(0, 10));
      return;
    } else {
      if (userLeads.length < 20) {
        sendResponse(
          res,
          200,
          "Currently generating leads, please wait a moment",
          userLeads
        );
        if (
          customer?.leadsGenerationStatus === LeadsGenerationStatus.COMPLETED
        ) {
          await step2LeadGen(userId, 20 - userLeads.length);
        }
        return;
      }
    }

    sendResponse(
      res,
      200,
      "Leads gotten",
      !user.subscriptionName ? userLeads.slice(0, 10) : userLeads.slice(0, 20)
    );
    return;
  } catch (error: any) {
    logger.error(error, "Error in userLeads:");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};