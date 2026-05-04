import { Request, Response } from "express";
import { apolloPeopleSearch } from "../../controllers/leadsController/apolloPeopleSearch";
import { apolloEnrichedPeople } from "../../controllers/leadsController/apolloEnrichedPeople";
import { persistApolloResults } from "../../controllers/leadGenV2/persistApolloResults";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

const parseInputArray = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const parseBoolean = (value: any, defaultValue = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return defaultValue;
};

const parseNumber = (value: any, fallback = 10): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const generateLeadsAdmin = async (req: Request, res: Response) => {
  try {
    const payload: any = req.body;
    const titles = parseInputArray(payload?.titles);
    const locations = parseInputArray(payload?.locations);
    const personSeniorities = parseInputArray(
      payload?.person_seniorities ?? payload?.personSeniorities,
    );
    const includeSimilarTitles = parseBoolean(
      payload?.include_similar_titles ?? payload?.includeSimilarTitles,
      true,
    );
    const numberOfLeads = Math.max(
      1,
      parseNumber(payload?.numberOfLeads ?? payload?.numberOfLeads, 10),
    );

    if (!titles.length || !locations.length) {
      return sendResponse(
        res,
        400,
        "Please provide at least one title and one location.",
        null,
        "titles and locations are required",
      );
    }

    const searchParams: Record<string, any> = {
      person_titles: titles,
      organization_locations: locations,
      include_similar_titles: includeSimilarTitles,
      contact_email_status: ["verified", "likely to engage"],
      per_page: 100,
      page: 1,
    };

    if (personSeniorities.length) {
      searchParams.person_seniorities = personSeniorities;
    }

    const apolloPageSize = 100;
    let page = 1;
    let totalPages = 0;
    const triedIds = new Set<string>();
    const enrichedLeads: any[] = [];

    while (enrichedLeads.length < numberOfLeads) {
      searchParams.page = page;
      searchParams.per_page = apolloPageSize;
      const searchResult = await apolloPeopleSearch(searchParams, page);
      const people = Array.isArray(searchResult?.people)
        ? searchResult.people
        : [];
      const totalEntries = Number(searchResult?.total_entries) || 0;
      if (totalEntries > 0) {
        totalPages = Math.ceil(totalEntries / apolloPageSize);
      }

      if (!people.length) {
        break;
      }

      const pageIds: string[] = people
        .map((person: any) => person?.id ?? person?.person_id)
        .filter(
          (id: any) =>
            typeof id === "string" && id.length > 0 && !triedIds.has(id),
        ) as string[];

      pageIds.forEach((id: string) => triedIds.add(id));

      if (pageIds.length) {
        const batchLeads = await apolloEnrichedPeople(pageIds);
        if (Array.isArray(batchLeads) && batchLeads.length) {
          enrichedLeads.push(...batchLeads);
        }
      }

      if (totalPages > 0 && page >= totalPages) {
        break;
      }

      page += 1;
    }

    const resultLeads = enrichedLeads.slice(0, numberOfLeads);
    await persistApolloResults(resultLeads);

    const records = enrichedLeads
      .slice(0, numberOfLeads)
      .map((lead: any, index: number) => {
        const idBase =
          lead?.id ||
          lead?.external_id ||
          lead?.email ||
          lead?.linkedin_url ||
          lead?.person_id ||
          `lead-${index}`;

        const org = lead?.organization ?? {};
        const locationParts = [
          lead?.city ?? org?.city,
          lead?.state ?? org?.state,
          lead?.country ?? org?.country,
        ]
          .filter((part) => typeof part === "string" && part.trim().length)
          .join(", ");

        return {
          id: `${idBase}-${index}`,
          Name: lead?.name ?? lead?.full_name ?? "",
          Title: lead?.title ?? "",
          "Company Name": org?.name ?? org?.organization_name ?? "",
          Website:
            org?.website_url ??
            (typeof org?.website === "string" ? org.website : ""),
          "E-mail": lead?.email ?? "",
          "Phone number":
            lead?.phone ??
            (Array.isArray(lead?.phone_numbers) && lead.phone_numbers[0]?.number
              ? lead.phone_numbers[0].number
              : ""),
          Location: locationParts,
          Industry:
            org?.industry ??
            (Array.isArray(org?.industries) ? org.industries.join(", ") : ""),
          "Linkedin profile": lead?.linkedin_url ?? "",
        };
      });

    return sendResponse(res, 200, "Leads generated successfully", records);
  } catch (error: any) {
    logger.error(error, "Error in generateLeadsAdmin:");
    sendResponse(
      res,
      500,
      "Internal Server Error",
      null,
      error.message ?? "Unknown error",
    );
  }
};
