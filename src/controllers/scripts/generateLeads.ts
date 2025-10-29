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
  const page = request.params.page;
  console.log("Page :", page);
  let totalPages = 0;
  let currentPage = page;
  let newCompany = 0;
  let newLead = 0;
  try {
    let peopleIds = [];
    let peopleData = [];
    const apiResponse = await axios.post(
      APOLLO_PEOPLE_URL,
      {
        person_titles: DEFAULT_TITLES,
        organization_locations: DEFAULT_LOCATIONS,
        include_similar_titles: true,
        contact_email_status: ["verified", "likely to engage"],
        per_page: 100,
        page,
      },
      { headers: buildApolloHeaders() }
    );
    totalPages = apiResponse.data.pagination.total_pages;
    currentPage = apiResponse.data.pagination.page;
    peopleIds = apiResponse.data.model_ids;
    peopleData = apiResponse.data.people;
    for (const person of peopleData) {
      if(!person.organization.id){
        continue
      }
      const company = await Companies.findOne({
        where: { external_id: person.organization.id },
      });
      if (!company) {
        const { id, ...companyInfo } = person.organization;
        await Companies.create({
          id: v4(),
          ...companyInfo,
          external_id: person.organization.id,
        });
        newCompany++;
      }
    }
    const enrichedData = await apolloEnrichedPeople(peopleIds);
    console.log(enrichedData[0])
    for (const person of enrichedData) {
      if(!person.id){
        continue
      }
      const lead = await GeneralLeads.findOne({
        where: { external_id: person.id },
      });
      if (!lead) {
        const { id, ...leadInfo } = person;
        await GeneralLeads.create({
          id: v4(),
          ...leadInfo,
          external_id: person.id,
        });
        newLead++;
      }
    }
    sendResponse(response, 200, "Success", {
      totalPages: apiResponse.data.pagination.total_pages,
      currentPage: apiResponse.data.pagination.page,
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
