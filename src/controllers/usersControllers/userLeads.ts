import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import { Leads } from "../../models/Leads";
import Users from "../../models/Users";
import { findLeads } from "../aiControllers/findLeads";

export const userLeads = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const user = await Users.findOne({ where: { id: userId } });

    if(!user) {
      sendResponse(res, 400, "User not found");
      return;
    }
    const userLeads = await Leads.findAll({ where: { owner_id: userId } });
    if (!userLeads || userLeads.length === 0) {
      await findLeads(userId);
      sendResponse(res, 400, "Currently generating leads, please wait a moment");
      return;
    }
    if(!user.subscriptionName){
      sendResponse(res, 200, "Leads gotten", userLeads.slice(0, 10));
      return;
    }
    sendResponse(res, 200, "Leads gotten", userLeads);
    return;
  } catch (error: any) {
    console.error("Error in leadsController:", error.message);
    sendResponse(res, 500, "Internal server error");
    return;
  }
};
