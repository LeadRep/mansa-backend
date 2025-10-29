import { Request, Response } from "express";
import axios from "axios";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Companies from "../../models/Companies";
import { v4 } from "uuid";
import { apolloEnrichedPeople } from "../leadsController/apolloEnrichedPeople";
import { GeneralLeads } from "../../models/GeneralLeads";

const APOLLO_PEOPLE_URL = "https://api.apollo.io/v1/mixed_people/search";
const APOLLO_ENRICH_URL = "https://api.apollo.io/v1/people/bulk_match";
const DEFAULT_TITLES = [
  "Independent Financial Advisor",
  "Financial Advisor",
  "Financial Planner",
  "Certified Financial Planner",
  "CFP",
  "Insurance Broker",
  "Robo Advisor",
  "Financial Consultant",
  "Wealth Manager",
  "Family Office",
  "Portfolio Manager",
  "Fund manager",
  "CIO",
  "Manager selection",
  "Analyst",
];
const DEFAULT_LOCATIONS = ["Finland", "Denmark", "Sweden", "Norway"];

const buildApolloHeaders = () => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

export const generateLeads = async (request: Request, response: Response) => {
  const startPageParam = request.params.page;
  const endPageParam = request.params.endPage;

  const startPage = Number.parseInt(startPageParam ?? "", 10);

  let endPageValue: string | undefined;
  if (typeof endPageParam === "string") {
    endPageValue = endPageParam;
  } else if (Array.isArray(endPageParam) && typeof endPageParam[0] === "string") {
    endPageValue = endPageParam[0];
  }

  const endPage = Number.parseInt(endPageValue ?? "", 10);

  if (Number.isNaN(startPage) || Number.isNaN(endPage)) {
    sendResponse(
      response,
      400,
      "Start and end page required",
      null,
      "Invalid pagination parameters"
    );
    return;
  }

  if (startPage < 1 || endPage < startPage) {
    sendResponse(
      response,
      400,
      "Invalid pagination range",
      null,
      "Ensure startPage >= 1 and endPage >= startPage"
    );
    return;
  }
  try {
    let newCompany = 0;
    let newLead = 0;
    for (let currentPage = startPage; currentPage <= endPage; currentPage += 1) {
      let peopleIds: Array<string | null | undefined> = [];
      let peopleData: Array<any> = [];

      const apiResponse = await axios.post(
        APOLLO_PEOPLE_URL,
        {
          person_titles: DEFAULT_TITLES,
          organization_locations: DEFAULT_LOCATIONS,
          include_similar_titles: true,
          contact_email_status: ["verified", "likely to engage"],
          per_page: 100,
          page: currentPage,
        },
        { headers: buildApolloHeaders() }
      );

      peopleIds = apiResponse.data.model_ids;
      peopleData = apiResponse.data.people;

      for (const person of peopleData) {
        const organizationId = person?.organization?.id;
        if (!organizationId) {
          continue;
        }
        const company = await Companies.findOne({
          where: { external_id: organizationId },
        });
        if (!company) {
          const organizationPayload = person.organization ?? {};
          const { id, ...companyInfo } = organizationPayload;
          await Companies.create({
            id: v4(),
            ...companyInfo,
            external_id: organizationId,
          });
          newCompany++;
        }
      }

      const validPeopleIds = peopleIds.filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim().length > 0
      );
      if (!validPeopleIds.length) {
        continue;
      }

      const enrichedData = await apolloEnrichedPeople(validPeopleIds);
      for (const person of enrichedData) {
        const personId = person?.id ?? person?.person_id;
        if (!personId) {
          continue;
        }
        const lead = await GeneralLeads.findOne({
          where: { external_id: personId },
        });
        if (!lead) {
          const { id, person_id, ...leadInfo } = person ?? {};
          await GeneralLeads.create({
            id: v4(),
            ...leadInfo,
            external_id: personId,
          });
          newLead++;
        }
      }
    }
    sendResponse(response, 200, "Success", {
      newCompany,
      newLead,
    });
    return;
  } catch (error: any) {
    logger.error(error, "Error generating leads");
    sendResponse(response, 500, "Internal Server Error", null, error?.message);
    return;
  }
};
