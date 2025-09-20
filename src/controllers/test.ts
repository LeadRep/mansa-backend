import e, { Request, Response } from "express";
import sendResponse from "../utils/http/sendResponse";
import { aiPeopleSearchQuery } from "./leadsController/aiPeopleSearchQuery";
import { apolloPeopleSearch } from "./leadsController/apolloPeopleSearch";
import logger from "../logger";

export const test = async (req: Request, res: Response) => {
  try {
    const params = await aiPeopleSearchQuery(
      "aa862323-f8b5-48a8-a97a-a601b6f6acca"
    );
    const leads = await apolloPeopleSearch(params);
    // const enrichedPeople = await apolloEnrichedPeople(leads.model_ids);
    sendResponse(res, 200, "Leads generated successfully", leads);
    return;
  } catch (error: any) {
    logger.error(error, "Error");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
