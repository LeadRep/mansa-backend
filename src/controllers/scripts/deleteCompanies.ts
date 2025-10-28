import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import Companies from "../../models/Companies";
import { GeneralLeads } from "../../models/GeneralLeads";

export const deleteCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await Companies.destroy({ where: {external_id: null} });
    sendResponse(res, 200, "Companies deleted successfully", {
      companies,
    });
  } catch (error: any) {
    console.log("Error:", error.message);
    sendResponse(res, 500, "Failed to delete companies", null, error.message);
    return;
  }
};
