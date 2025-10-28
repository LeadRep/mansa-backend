import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import sendResponse from "../../utils/http/sendResponse";
import Companies from "../../models/Companies";
import {
  GeneralLeads,
  GeneralLeadsCreationAttributes,
} from "../../models/GeneralLeads";
import logger from "../../logger";

const APOLLO_PEOPLE_URL = "https://api.apollo.io/v1/mixed_people/search";
const APOLLO_ENRICH_URL = "https://api.apollo.io/v1/people/bulk_match";

const DEFAULT_TITLES = [
  "Portfolio Manager",
  "Fund Manager",
  "CIO",
  "Manager selection",
  "Analyst",
];

const DEFAULT_LOCATIONS = ["finland", "denmark", "sweden", "norway", "austria"];

const SEARCH_CHUNK_SIZE = 25;
const ENRICH_BATCH_SIZE = 10;
const DEFAULT_PER_PAGE = 100;

const buildApolloHeaders = () => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

const fetchPeople = async ({
  titles,
  locations,
  organizationIds,
  perPage = DEFAULT_PER_PAGE,
}: {
  titles: string[];
  locations: string[];
  organizationIds: string[];
  perPage?: number;
}): Promise<any[]> => {
  const uniquePeople = new Map<string, any>();

  for (
    let index = 0;
    index < organizationIds.length;
    index += SEARCH_CHUNK_SIZE
  ) {
    const batch = organizationIds.slice(index, index + SEARCH_CHUNK_SIZE);
    let page = 1;
    let totalPages = 1;

    do {
      try {
        const response = await axios.post(
          APOLLO_PEOPLE_URL,
          {
            organization_ids: batch,
            person_titles: titles,
            include_similar_titles: true,
            organization_locations: locations,
            contact_email_status: ["verified", "likely to engage"],
            per_page: perPage,
            page,
          },
          { headers: buildApolloHeaders() }
        );

        const people = response.data?.people ?? [];
        for (const person of people) {
          const personId = person?.id;
          if (personId && !uniquePeople.has(personId)) {
            uniquePeople.set(personId, person);
          }
        }

        totalPages = response.data?.pagination?.total_pages ?? 1;
      } catch (error: any) {
        logger.warn(
          {
            error: error?.message,
            status: error?.response?.status,
          },
          "Failed to fetch people for organization batch"
        );
        break;
      }

      page += 1;
    } while (page <= totalPages);
  }

  return Array.from(uniquePeople.values());
};

const enrichPeople = async (peopleIds: string[]): Promise<any[]> => {
  if (!peopleIds.length) {
    return [];
  }

  const enriched: any[] = [];

  for (let index = 0; index < peopleIds.length; index += ENRICH_BATCH_SIZE) {
    const batchIds = peopleIds
      .slice(index, index + ENRICH_BATCH_SIZE)
      .map((id) => ({ id }));

    try {
      const response = await axios.post(
        APOLLO_ENRICH_URL,
        { details: batchIds },
        { headers: buildApolloHeaders() }
      );

      enriched.push(...(response.data?.matches ?? []));
    } catch (error: any) {
      logger.warn(
        {
          error: error?.message,
          status: error?.response?.status,
        },
        "Failed to enrich batch of people"
      );
    }
  }

  return enriched;
};

const mapEnrichedLead = (lead: any): GeneralLeadsCreationAttributes => {
  const organization = lead.organization ?? null;
  const externalId = lead.id ?? lead.person_id ?? null;
  const primaryPhone = Array.isArray(lead.phone_numbers)
    ? lead.phone_numbers[0]?.number
    : undefined;

  return {
    external_id: externalId,
    first_name: lead.first_name ?? null,
    last_name: lead.last_name ?? null,
    full_name: lead.name ?? lead.full_name ?? null,
    name: lead.name ?? lead.full_name ?? null,
    linkedin_url: lead.linkedin_url ?? null,
    title: lead.title ?? null,
    photo_url: lead.photo_url ?? null,
    twitter_url: lead.twitter_url ?? null,
    github_url: lead.github_url ?? null,
    facebook_url: lead.facebook_url ?? null,
    headline: lead.headline ?? null,
    email_status: lead.email_status ?? null,
    extrapolated_email_confidence:
      lead.extrapolated_email_confidence ?? null,
    email: lead.email ?? null,
    phone: primaryPhone ?? lead.phone ?? null,
    organization_id: organization?.id ?? null,
    organization,
    employment_history: lead.employment_history ?? null,
    departments: Array.isArray(lead.departments) ? lead.departments : null,
    subdepartments: Array.isArray(lead.subdepartments)
      ? lead.subdepartments
      : null,
    seniority: lead.seniority ?? null,
    functions: Array.isArray(lead.functions) ? lead.functions : null,
    state: lead.state ?? null,
    city: lead.city ?? null,
    country: lead.country ?? null,
    street_address: lead.street_address ?? null,
    postal_code: lead.postal_code ?? null,
    formatted_address: lead.formatted_address ?? null,
    time_zone: lead.time_zone ?? null,
    category: lead.category ?? null,
    reason: lead.reason ?? null,
    score: lead.score ?? null,
    intent_strength: lead.intent_strength ?? null,
    show_intent:
      typeof lead.show_intent === "boolean" ? lead.show_intent : null,
    email_domain_catchall:
      typeof lead.email_domain_catchall === "boolean"
        ? lead.email_domain_catchall
        : null,
    revealed_for_current_team:
      typeof lead.revealed_for_current_team === "boolean"
        ? lead.revealed_for_current_team
        : null,
  };
};

export const findOrganizationLeads = async (req: Request, res: Response) => {
  try {
    const allCompanies = await Companies.findAll({
      where: { external_id: { [Op.ne]: null } },
      attributes: ["id", "name", "external_id", "primary_domain"],
    });

    if (!allCompanies.length) {
      sendResponse(res, 200, "No companies found with external IDs");
      return;
    }

    const organizationIds = Array.from(
      new Set(
        allCompanies
          .map((company) => company.external_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (!organizationIds.length) {
      sendResponse(res, 200, "No organization IDs available for search", {
        totalCompanies: allCompanies.length,
      });
      return;
    }

    const titles =
      Array.isArray(req.body?.titles) && req.body.titles.length
        ? req.body.titles
        : DEFAULT_TITLES;
    const locations =
      Array.isArray(req.body?.locations) && req.body.locations.length
        ? req.body.locations
        : DEFAULT_LOCATIONS;

    const people = await fetchPeople({
      titles,
      locations,
      organizationIds,
      perPage: DEFAULT_PER_PAGE,
    });

    if (!people.length) {
      sendResponse(res, 200, "No leads found for provided parameters", {
        totalCompanies: allCompanies.length,
        organizationIds: organizationIds.length,
        titles,
        locations,
        totalFetched: 0,
        enriched: 0,
        saved: 0,
      });
      return;
    }

    const leadIds = people
      .map((person) => person?.id)
      .filter((id): id is string => Boolean(id));

    if (!leadIds.length) {
      sendResponse(res, 200, "Fetched people but none contained IDs", {
        totalCompanies: allCompanies.length,
        organizationIds: organizationIds.length,
        titles,
        locations,
        totalFetched: people.length,
        enriched: 0,
        saved: 0,
      });
      return;
    }

    const enrichedLeads = await enrichPeople(leadIds);
    const enrichedWithIds = enrichedLeads.filter((lead: any) =>
      Boolean(lead?.id ?? lead?.person_id)
    );

    if (!enrichedWithIds.length) {
      sendResponse(res, 200, "No enriched leads returned with ids", {
        totalCompanies: allCompanies.length,
        organizationIds: organizationIds.length,
        titles,
        locations,
        totalFetched: people.length,
        enriched: enrichedLeads.length,
        saved: 0,
      });
      return;
    }

    const mappedLeads: GeneralLeadsCreationAttributes[] =
      enrichedWithIds.map(mapEnrichedLead);

    const savedLeads = await GeneralLeads.bulkCreate(mappedLeads, {
      updateOnDuplicate: [
        "external_id",
        "first_name",
        "last_name",
        "full_name",
        "name",
        "title",
        "linkedin_url",
        "photo_url",
        "twitter_url",
        "github_url",
        "facebook_url",
        "headline",
        "email_status",
        "extrapolated_email_confidence",
        "email",
        "phone",
        "organization",
        "organization_id",
        "employment_history",
        "departments",
        "subdepartments",
        "seniority",
        "functions",
        "state",
        "city",
        "country",
        "street_address",
        "postal_code",
        "formatted_address",
        "time_zone",
        "category",
        "reason",
        "score",
        "intent_strength",
        "show_intent",
        "email_domain_catchall",
        "revealed_for_current_team",
      ],
    });

    sendResponse(res, 200, "Organization leads processed successfully", {
      totalCompanies: allCompanies.length,
      organizationIds: organizationIds.length,
      titles,
      locations,
      totalFetched: people.length,
      enriched: enrichedWithIds.length,
      saved: savedLeads.length,
    });
  } catch (error: any) {
    logger.error(
      {
        error: error?.message,
        stack: error?.stack,
      },
      "Failed to find organization leads"
    );
    sendResponse(res, 500, "Internal server error", null, error?.message);
    return;
  }
};
