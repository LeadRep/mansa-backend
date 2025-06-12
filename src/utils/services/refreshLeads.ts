import Users from "../../models/Users";
import { findLeads } from "../../controllers/aiControllers/findLeads";
import { Request, Response } from "express";
import sendResponse from "../http/sendResponse";
import { Leads } from "../../models/Leads";

export const refreshLeads = async (request: Request, response: Response) => {
  try {
    const leads = await findLeads("fa20b943-19da-4819-8389-c6b59ea6b0a5", 10);
    sendResponse(response, 200, "Leads refreshed successfully", leads);
    return;
  } catch (error: any) {
    console.error("Error while refreshing leads:", error.message);
    sendResponse(response, 500, "Error while refreshing leads");
  }
};
