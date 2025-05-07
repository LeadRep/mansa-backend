import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import { Leads } from "../../models/Leads";

export const userLeads = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const userLeads = await Leads.findAll({ where: { owner_id: userId } });
    sendResponse(res, 200, "Leads gotten", userLeads);
    return;
  } catch (error: any) {
    console.error("Error in leadsController:", error.message);
    sendResponse(res, 500, "Internal server error");
    return;
  }
};
