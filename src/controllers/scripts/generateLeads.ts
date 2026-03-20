import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import ACICompanies from "../../models/ACICompanies";
import { v4 } from "uuid";
import { apolloEnrichedPeople } from "../leadsController/apolloEnrichedPeople";
import { ACILeads } from "../../models/ACILeads";
import {apolloService} from "../../utils/http/services/apolloService";

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
  "Portfolio Management",
  "Senior Portfolio Manager",
  "Lead Portfolio Manager",
  "Head of Portfolio Management",
  "Multi-Asset Portfolio Manager",
  "Fund Management",
  "Fund Manager",
  "Senior Fund Manager",
  "Lead Fund Manager",
  "Head of Fund Management",
  "Investment Manager",
  "Chief Investment Leadership (CIO Level)",
  "Chief Investment Officer (CIO)",
  "Deputy Chief Investment Officer",
  "Head of Investments",
  "Investment Director",
  "Chief Investment Strategist",
  "Manager Selection / Fund Selection",
  "Head of Manager Selection",
  "Fund Selector",
  "Manager Selection Analyst",
  "Fund Research Analyst",
  "Head of Fund Research",
  "Investment Analyst",
  "Senior Investment Analyst",
  "Research Analyst",
  "Equity Research Analyst",
  "Quantitative Analyst"
];
const DEFAULT_LOCATIONS = ["Finland", "Denmark"];

export const generateLeads = async (request: Request, response: Response) => {
  const startPageParam = request.params.page;
  const endPageParam = request.params.endPage;

  const startPage = Number.parseInt(startPageParam);

  const endPage = Number.parseInt(endPageParam);

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
    const fetchPage = async (pageNumber: number) => {
      return apolloService.request(
        "mixed_people/api_search",
        {
          person_titles: DEFAULT_TITLES,
          organization_locations: DEFAULT_LOCATIONS,
          include_similar_titles: true,
          contact_email_status: ["verified", "likely to engage"],
          per_page: 100,
          page: pageNumber,
        }
      );
    };

    const processPageData = async (data: any) => {
      const peopleIds: Array<string | null | undefined> = data?.model_ids ?? [];
      for (const person of data.people) {
        peopleIds.push(person.id);
      }

      const peopleData: Array<any> = data?.people ?? [];

      const validPeopleIds = peopleIds.filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim().length > 0
      );

      if (!validPeopleIds.length) {
        return;
      }

      const enrichedData = await apolloEnrichedPeople(validPeopleIds);

      for (const person of enrichedData) {
        // Ensure company using enriched organization payload (more complete)
        const organizationId = person?.organization?.id;
        if (organizationId) {
          const company = await ACICompanies.findOne({
            where: { external_id: organizationId },
          });
          if (!company) {
            const organizationPayload = person.organization ?? {};
            const { id, ...companyInfo } = organizationPayload;
            await ACICompanies.create({
              id: v4(),
              ...companyInfo,
              external_id: organizationId,
            });
            newCompany++;
          }
        }

        const personId = person?.id ?? person?.person_id;
        if (!personId) {
          continue;
        }
        const lead = await ACILeads.findOne({
          where: { external_id: personId },
        });
        if (!lead) {
          const { id, person_id, ...leadInfo } = person ?? {};
          await ACILeads.create({
            id: v4(),
            ...leadInfo,
            external_id: personId,
          });
          newLead++;
        }       
      }
    };

    let newCompany = 0;
    let newLead = 0;

    let firstResponse;
    try {
      firstResponse = await fetchPage(startPage);
    } catch (apiError: any) {
      const status = apiError?.response?.status;
      const message =
        apiError?.response?.data?.error ??
        apiError?.response?.data?.message ??
        apiError?.message ??
        "Apollo request failed";
      logger.error({ status, message, page: startPage }, "Failed to fetch page");
      sendResponse(
        response,
        status ?? 500,
        "Failed to fetch leads",
        null,
        message
      );
      return;
    }

    const totalPages =firstResponse?.data?.total_entries? Math.ceil(firstResponse?.data?.total_entries/100): 0

    if (!totalPages || totalPages < 1) {
      sendResponse(response, 200, "No pages available from Apollo", {
        totalPages: totalPages ?? 0,
      });
      return;
    }

    if (startPage > totalPages) {
      sendResponse(response, 400, "Requested start page exceeds available pages", {
        totalPages,
      });
      return;
    }

    if (endPage > totalPages) {
      sendResponse(response, 400, "Requested end page exceeds available pages", {
        totalPages,
      });
      return;
    }

    await processPageData(firstResponse.data);

    for (let currentPage = startPage + 1; currentPage <= endPage; currentPage += 1) {
      try {
        const pageResponse = await fetchPage(currentPage);
        await processPageData(pageResponse.data);
      } catch (apiError: any) {
        const status = apiError?.response?.status;
        const message =
          apiError?.response?.data?.error ??
          apiError?.response?.data?.message ??
          apiError?.message ??
          "Apollo request failed";
        logger.error(
          { status, message, page: currentPage },
          "Stopping pagination due to error"
        );
        break;
      }
    }

    sendResponse(response, 200, "Success", {
      newCompany,
      newLead,
      totalPages,
    });
    return;
  } catch (error: any) {
    logger.error(error, "Error generating leads");
    sendResponse(response, 500, "Internal Server Error", null, error?.message);
    return;
  }
};
