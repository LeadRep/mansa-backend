import axios from "axios";
import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import {
  GeneralLeads,
  GeneralLeadsCreationAttributes,
} from "../../models/GeneralLeads";

const APOLLO_PEOPLE_URL = "https://api.apollo.io/v1/mixed_people/search";
const APOLLO_ENRICH_URL = "https://api.apollo.io/v1/people/bulk_match";

const DEFAULT_TITLES = [
  "Portfolio Manager",
  "Fund Manager",
  "CIO",
  "Manager selection",
  "Analyst",
];

const DEFAULT_LOCATIONS = [
  "finland",
  "denmark",
  "sweden",
  "norway",
  "austria",
];

interface LeadSearchOptions {
  titles: string[];
  locations: string[];
  perPage: number;
}

const buildApolloHeaders = () => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

const fetchPeople = async ({
  titles,
  locations,
  perPage,
}: LeadSearchOptions): Promise<any[]> => {
  const allPeople: any[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await axios.post(
      APOLLO_PEOPLE_URL,
      {
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
    allPeople.push(...people);

    totalPages = response.data?.pagination?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return allPeople;
};

const enrichPeople = async (peopleIds: string[]): Promise<any[]> => {
  if (!peopleIds.length) {
    return [];
  }

  const enriched: any[] = [];

  for (let index = 0; index < peopleIds.length; index += 10) {
    const batchIds = peopleIds.slice(index, index + 10).map((id) => ({ id }));

    const response = await axios.post(
      APOLLO_ENRICH_URL,
      { details: batchIds },
      { headers: buildApolloHeaders() }
    );

    enriched.push(...(response.data?.matches ?? []));
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
    extrapolated_email_confidence: lead.extrapolated_email_confidence ?? null,
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
    show_intent: lead.show_intent ?? null,
    email_domain_catchall: lead.email_domain_catchall ?? null,
    revealed_for_current_team: lead.revealed_for_current_team ?? null,
  };
};

export const generateNewLeads = async (req: Request, res: Response) => {
  const titles = Array.isArray(req.body?.titles) && req.body.titles.length
    ? req.body.titles
    : DEFAULT_TITLES;
  const locations =
    Array.isArray(req.body?.locations) && req.body.locations.length
      ? req.body.locations
      : DEFAULT_LOCATIONS;

  try {
    const people = await fetchPeople({
      titles,
      locations,
      perPage: Number(req.body?.perPage) || 100,
    });

    if (!people.length) {
      sendResponse(res, 200, "No leads found for provided parameters", {
        titles,
        locations,
        totalFetched: 0,
        enriched: 0,
        saved: 0,
      });
      return;
    }

    const seen = new Set<string>();
    const uniquePeople = people.filter((person: any) => {
      const personId = person?.id;
      if (!personId || seen.has(personId)) {
        return false;
      }
      seen.add(personId);
      return true;
    });
    const leadIds = uniquePeople.map((person) => person.id);

    const enrichedLeads = await enrichPeople(leadIds);

    if (!enrichedLeads.length) {
      sendResponse(res, 200, "No enriched leads returned from Apollo", {
        titles,
        locations,
        totalFetched: uniquePeople.length,
        enriched: 0,
        saved: 0,
      });
      return;
    }

    const enrichedWithIds = enrichedLeads.filter(
      (lead: any) => Boolean(lead?.id ?? lead?.person_id)
    );

    if (!enrichedWithIds.length) {
      sendResponse(res, 200, "No enriched leads returned with valid IDs", {
        titles,
        locations,
        totalFetched: uniquePeople.length,
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
        "email_status",
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

    sendResponse(res, 200, "Leads generated successfully", {
      titles,
      locations,
      totalFetched: uniquePeople.length,
      enriched: enrichedWithIds.length,
      saved: savedLeads.length,
    });
  } catch (error: any) {
    logger.error(error, "Failed to generate new leads");
    sendResponse(res, 500, "Internal Server Error", null, error?.message);
  }
};
