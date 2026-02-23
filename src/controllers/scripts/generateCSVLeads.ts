import { Request, Response } from "express";
import { apolloEnrichedPeople } from "../leadsController/apolloEnrichedPeople";
import sendResponse from "../../utils/http/sendResponse";
import {apolloService} from "../../utils/http/services/apolloService";

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

const parseNumber = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const generateCSVLeads = async (req: Request, res: Response) => {
  try {
    const payload: any = req.method === "GET" ? req.query : req.body;
    const titles = parseInputArray(payload?.titles);
    const locations = parseInputArray(payload?.locations);
    const person_seniorities = parseInputArray(payload?.person_seniorities);
    const include_similar_titles = parseBoolean(
      payload?.include_similar_titles,
      true
    );
    const numberOfLeads = parseNumber(payload?.numberOfLeads, 10);
    const effectiveCount = Math.max(1, Math.min(numberOfLeads, 25));

    const response = await apolloService.request(
      "mixed_people/api_search",
      {
        person_titles: titles,
        organization_locations: locations,
        include_similar_titles: include_similar_titles,
        person_seniorities: person_seniorities,
        contact_email_status: ["verified", "likely to engage"],
        per_page: effectiveCount,
        page: 1,
      },
    );
    const peopleData = response.data.model_ids;
    const people = peopleData.slice(0, effectiveCount);
    const enrichedData = await apolloEnrichedPeople(people);
    console.log("enrichedData:", enrichedData[0]);
    const records = enrichedData.map((lead: any) => {
      const org = lead?.organization ?? {};
      const locationParts = [
        lead?.city ?? org?.city,
        lead?.state ?? org?.state,
        lead?.country ?? org?.country,
      ]
        .filter((part) => typeof part === "string" && part.trim().length)
        .join(", ");

      return {
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

    sendResponse(res, 200, "Leads generated successfully", records);
  } catch (error: any) {
    console.log("generateCSVLeads Error:", error.message);
    sendResponse(res, 500, "Internal Server Error", null, error.message);
    return;
  }
};
