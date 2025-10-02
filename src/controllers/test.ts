import { Request, Response } from "express";
import sendResponse from "../utils/http/sendResponse";
import { aiPeopleSearchQuery } from "./leadsController/aiPeopleSearchQuery";
import { apolloPeopleSearch } from "./leadsController/apolloPeopleSearch";
import { apolloEnrichedPeople } from "./leadsController/apolloEnrichedPeople";
import { CustomerPref } from "../models/CustomerPref";
import { Leads } from "../models/Leads";
import { aiEvaluatedLeads } from "./leadsController/aiEvaluatedLeads";
import { step2LeadGen } from "./leadsController/step2LeadGen";
import axios from "axios";

export const test = async (req: Request, res: Response) => {
  try {
    const userId = "aa862323-f8b5-48a8-a97a-a601b6f6acca";
    const newLeads = await step2LeadGen(userId, 10);
    // const searchResponse = await axios.post(
    //   "https://api.apollo.io/v1/mixed_people/search",
    //   {
    //     // q_organization_domains_list: batch,
    //     person_titles: [
    //       "CIO",
    //       "Chief Investment Officer",
    //       "Fund Manager",
    //       "Manager Selection",
    //       "Analyst",
    //       "Portfolio Manager",
    //     ],
    //     organization_locations: ["finland"],
    //     include_similar_titles: true,
    //     contact_email_status: ["verified", "likely to engage"],
    //     per_page: 100,
    //   },
    //   {
    //     headers: {
    //       "Cache-Control": "no-cache",
    //       "Content-Type": "application/json",
    //       accept: "application/json",
    //       "x-api-key": process.env.APOLLO_API_KEY!,
    //     },
    //   }
    // );
    sendResponse(res, 200, "Leads generated successfully", newLeads);
    return;
  } catch (error: any) {
    logger.error(error, "Error");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
