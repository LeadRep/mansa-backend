import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import ACICompanies from "../../models/ACICompanies";
import { v4 } from "uuid";
import { apolloEnrichedPeople } from "../leadsController/apolloEnrichedPeople";
import { ACILeads } from "../../models/ACILeads";
import {apolloService} from "../../utils/http/services/apolloService";
import { GeneralLeads } from "../../models/GeneralLeads";
import Companies from "../../models/Companies";

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
        // Process company data - Upsert into ACICompanies and Companies tables
        const organizationId = person?.organization?.id;
        if (organizationId) {
          const organizationPayload = person.organization ?? {};
          const { id, ...companyInfo } = organizationPayload;
          const companyId = v4();

          try {
            // Upsert into ACICompanies (ACI-specific table)
            const [aciCompany, aciCreated] = await ACICompanies.findOrCreate({
              where: { external_id: organizationId },
              defaults: {
                id: companyId,
                ...companyInfo,
                external_id: organizationId,
              }
            });

            if (!aciCreated) {
              // Update existing record
              await aciCompany.update(companyInfo);
              updatedCompany++;
            } else {
              newCompany++;
            }

            // Upsert into Companies (org-wide general table)
            const [generalCompany, generalCompanyCreated] = await Companies.findOrCreate({
              where: { external_id: organizationId },
              defaults: {
                id: companyId,
                ...companyInfo,
                external_id: organizationId,
              }
            });

            if (!generalCompanyCreated) {
              // Update existing record in general table
              await generalCompany.update(companyInfo);
            }
          } catch (companyError: any) {
            logger.error({ organizationId, error: companyError.message }, "Error processing company");
          }
        }

        // Process lead data - Upsert into ACILeads and GeneralLeads tables
        const personId = person?.id ?? person?.person_id;
        if (!personId) {
          continue;
        }

        try {
          const { id, person_id, ...leadInfo } = person ?? {};
          const leadId = v4();

          // Upsert into ACILeads (ACI-specific table)
          const [aciLead, aciLeadCreated] = await ACILeads.findOrCreate({
            where: { external_id: personId },
            defaults: {
              id: leadId,
              ...leadInfo,
              external_id: personId,
            }
          });

          if (!aciLeadCreated) {
            // Update existing record
            await aciLead.update(leadInfo);
            updatedLead++;
          } else {
            newLead++;
          }

          // Upsert into GeneralLeads (org-wide cache table)
          const [generalLead, generalLeadCreated] = await GeneralLeads.findOrCreate({
            where: { external_id: personId },
            defaults: {
              id: leadId,
              ...leadInfo,
              external_id: personId,
            }
          });

          if (!generalLeadCreated) {
            // Update existing record in general table
            await generalLead.update(leadInfo);
          }
        } catch (leadError: any) {
          logger.error({ personId, error: leadError.message }, "Error processing lead");
        }
      }
    };

    let newCompany = 0;
    let newLead = 0;
    let updatedCompany = 0;
    let updatedLead = 0;

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
      companies: {
        new: newCompany,
        updated: updatedCompany,
        total: newCompany + updatedCompany
      },
      leads: {
        new: newLead,
        updated: updatedLead,
        total: newLead + updatedLead
      },
      totalPages,
      details: "Leads added to ACILeads, GeneralLeads, Companies, and ACICompanies tables"
    });
    return;
  } catch (error: any) {
    logger.error(error, "Error generating leads");
    sendResponse(response, 500, "Internal Server Error", null, error?.message);
    return;
  }
};