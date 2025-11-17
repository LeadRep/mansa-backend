import { Request, Response } from "express";
import { apolloEnrichedPeople } from "../leadsController/apolloEnrichedPeople";
import axios from "axios";
import { Parser as Json2CsvParser } from "json2csv";
import sendResponse from "../../utils/http/sendResponse";

const APOLLO_PEOPLE_URL = "https://api.apollo.io/v1/mixed_people/search";
const DEFAULT_TITLES = [
  "Ressortleiter Innovationsförderung",
  "Startup & Innovation Policy Officer",
  "Head of Research & Innovation Policy",
  "Leiter Technologie und Innovation",
  "Head of Research & Innovation Policy",
  "Leiter Standortförderung",
  "Leiter Wirtschaftsförderung",
  "Leiter Amt für Wirtschaft und Arbeit",
];
const DEFAULT_LOCATIONS = ["Germany"];
 
const buildApolloHeaders = () => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

export const generateCSVLeads = async (req: Request, res: Response) => {
  try {
    const response = await axios.post(
      APOLLO_PEOPLE_URL,
      {
        person_titles: DEFAULT_TITLES,
        organization_locations: DEFAULT_LOCATIONS,
        include_similar_titles: true,
        contact_email_status: ["verified", "likely to engage"],
        per_page: 100,
        page: 1,
      },
      { headers: buildApolloHeaders() }
    );
    const peopleData = response.data.model_ids;
    const people = peopleData.slice(0, 50);
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

    const parser = new Json2CsvParser({
      fields: [
        "Name",
        "Title",
        "Company Name",
        "Website",
        "E-mail",
        "Phone number",
        "Location",
        "Industry",
        "Linkedin profile",
      ],
    });
    const csv = parser.parse(records);

    const fileName = `apollo-leads-${DEFAULT_LOCATIONS[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.status(200).send(csv);
  } catch (error: any) {
    console.log("generateCSVLeads Error:", error.message);
    sendResponse(res, 500, "Internal Server Error", null, error.message);
    return;
  }
};
