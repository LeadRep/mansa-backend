import Users from "../../models/Users";
import { findLeads } from "../../controllers/aiControllers/findLeads";
import { Request, Response } from "express";
import sendResponse from "../http/sendResponse";
import { Leads } from "../../models/Leads";
import { customerPreference, customerPreferenceTest } from "../../controllers/aiControllers/customerPreference.ts";

export const refreshLeads = async (request: Request, response: Response) => {
  try {
    // const leads = await findLeads("fa20b943-19da-4819-8389-c6b59ea6b0a5", 10);
    // sendResponse(response, 200, "Leads refreshed successfully", leads);
    // return;
    const companyName = "Quirin Privatbank AG";
    const role = "Wealth Manager";
    const website = "https://www.hquirinprivatbank.de";
    const countries = "Germany";
    const ai = await customerPreferenceTest(companyName, role, website, countries);
    console.log(ai);
    return sendResponse(response, 200, "Customer preference generated successfully", ai);
  } catch (error: any) {
    console.error("Error while refreshing leads:", error.message);
    sendResponse(response, 500, "Error while refreshing leads");
  }
};
