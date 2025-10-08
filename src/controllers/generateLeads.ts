import { Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { parse } from "json2csv";

import sendResponse from "../utils/http/sendResponse";
import logger from "../logger";

const APOLLO_PEOPLE_URL = "https://api.apollo.io/v1/mixed_people/search";
const APOLLO_ENRICH_URL = "https://api.apollo.io/v1/people/bulk_match";
const APOLLO_ORG_URL = "https://api.apollo.io/v1/mixed_companies/search";
const DEFAULT_TITLES = [
  "CEO",
  "Director",
  "Procurement Manager",
  "Chief Procurement Officer",
  "Procurement Assistant",
  "Portfolio Manager",
];

interface CompanyRecord {
  name: string;
  country?: string;
  city?: string;
}

const resolveLeadsSourcePath = (): string => {
  const candidates = [
    path.join(__dirname, "imports.csv"),
    path.join(__dirname, "file.csv"),
    path.join(__dirname, "../aiControllers/imports.csv"),
    path.resolve(__dirname, "..", "..", "src/controllers/aiControllers/imports.csv"),
    path.resolve(__dirname, "..", "..", "src/controllers/imports.csv"),
    path.resolve(__dirname, "..", "..", "imports.csv"),
    path.resolve(process.cwd(), "src/controllers/aiControllers/imports.csv"),
    path.resolve(process.cwd(), "src/controllers/imports.csv"),
    path.resolve(process.cwd(), "src/controllers/file.csv"),
    path.resolve(process.cwd(), "imports.csv"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate leads import CSV file. Looked in: ${candidates.join(", ")}`
  );
};

const parseCsvSource = (csvContent: string) => {
  const rows = csvContent.split(/\r?\n/).filter((row) => row.trim().length);
  if (!rows.length) {
    throw new Error("CSV file is empty");
  }

  const headerColumns = rows[0]
    .replace(/^\uFEFF/, "")
    .split(";")
    .map((cell) => cell.trim());

  const domainIndex = headerColumns.findIndex((column) =>
    column.toLowerCase().includes("www-address")
  );
  const nameIndex = headerColumns.findIndex(
    (column) => column.toLowerCase() === "company name"
  );
  const countryIndex = headerColumns.findIndex(
    (column) => column.toLowerCase() === "country"
  );
  const cityIndex = headerColumns.findIndex(
    (column) => column.toLowerCase() === "city"
  );

  if (domainIndex === -1 && nameIndex === -1) {
    throw new Error(
      "CSV file must contain either a WWW-address or Company name column"
    );
  }

  const domainSet = new Set<string>();
  const companyRecords: CompanyRecord[] = [];
  const seenCompanies = new Set<string>();

  for (const row of rows.slice(1)) {
    if (!row.trim()) {
      continue;
    }

    const cells = row.split(";");

    if (
      nameIndex !== -1 &&
      cells[nameIndex] &&
      cells[nameIndex].trim().toLowerCase() === "company name"
    ) {
      continue;
    }

    if (domainIndex !== -1) {
      const rawDomain = cells[domainIndex]?.trim();
      const domain = extractDomain(rawDomain);
      if (domain) {
        domainSet.add(domain);
      }
    }

    if (nameIndex !== -1) {
      const companyName = cells[nameIndex]?.trim();
      if (companyName) {
        const key = `${companyName.toLowerCase()}|${
          cells[countryIndex]?.trim().toLowerCase() || ""
        }|${cells[cityIndex]?.trim().toLowerCase() || ""}`;
        if (!seenCompanies.has(key)) {
          seenCompanies.add(key);
          const country =
            countryIndex !== -1 ? cells[countryIndex]?.trim() || undefined : undefined;
          const city = cityIndex !== -1 ? cells[cityIndex]?.trim() || undefined : undefined;
          companyRecords.push({ name: companyName, country, city });
        }
      }
    }
  }

  return {
    domains: Array.from(domainSet),
    companies: companyRecords,
  };
};

const fetchLeadIdsForDomains = async (domains: string[]) => {
  const leadIds = new Set<string>();

  for (let i = 0; i < domains.length; i += 100) {
    const batch = domains.slice(i, i + 100);

    const response = await axios.post(
      APOLLO_PEOPLE_URL,
      {
        q_organization_domains_list: batch,
        person_titles: DEFAULT_TITLES,
        include_similar_titles: true,
        contact_email_status: ["verified", "likely to engage"],
        per_page: 100,
      },
      { headers: buildApolloHeaders() }
    );

    const people = response.data?.people ?? [];
    for (const person of people) {
      if (person?.id) {
        leadIds.add(person.id);
      }
    }
  }

  return Array.from(leadIds);
};

const fetchOrganizationIdsForCompanies = async (companies: CompanyRecord[]) => {
  const organizationIds = new Set<string>();

  for (const company of companies) {
    try {
      const payload: Record<string, any> = {
        q_organization_name: company.name,
        per_page: 100,
      };

      const locations = [company.city, company.country].filter(Boolean);
      if (locations.length) {
        payload.organization_locations = locations;
      }

      const response = await axios.post(APOLLO_ORG_URL, payload, {
        headers: buildApolloHeaders(),
      });

      const organizations =
        response.data?.organizations ?? response.data?.companies ?? [];

      for (const organization of organizations) {
        if (organization?.id) {
          organizationIds.add(organization.id);
        }
      }
    } catch (error: any) {
      logger.warn(
        `Failed to fetch organization for ${company.name}: ${error?.message}`
      );
    }
  }

  return Array.from(organizationIds);
};

const fetchLeadIdsForOrganizations = async (organizationIds: string[]) => {
  const leadIds = new Set<string>();
  const chunkSize = 25;

  for (let i = 0; i < organizationIds.length; i += chunkSize) {
    const batch = organizationIds.slice(i, i + chunkSize);
    let page = 1;
    let totalPages = 1;

    do {
      try {
        const response = await axios.post(
          APOLLO_PEOPLE_URL,
          {
            organization_ids: batch,
            person_titles: DEFAULT_TITLES,
            include_similar_titles: true,
            contact_email_status: ["verified", "likely to engage"],
            per_page: 100,
            page,
          },
          { headers: buildApolloHeaders() }
        );

        const people = response.data?.people ?? [];
        for (const person of people) {
          if (person?.id) {
            leadIds.add(person.id);
          }
        }

        totalPages = response.data?.pagination?.total_pages ?? 1;
      } catch (error: any) {
        logger.warn(
          `Failed to fetch leads for organization batch: ${error?.message}`
        );
        break;
      }

      page += 1;
    } while (page <= totalPages);
  }

  return Array.from(leadIds);
};

const enrichLeads = async (leadIds: string[]) => {
  const enriched: any[] = [];

  for (let i = 0; i < leadIds.length; i += 10) {
    const batchIds = leadIds.slice(i, i + 10).map((id) => ({ id }));
    const response = await axios.post(
      APOLLO_ENRICH_URL,
      { details: batchIds },
      { headers: buildApolloHeaders() }
    );

    enriched.push(...(response.data?.matches ?? []));
  }

  return enriched;
};

const buildApolloHeaders = () => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

export const generateLeads = async (request: Request, response: Response) => {
  try {
    const leadsSourcePath = resolveLeadsSourcePath();
    const csvContent = fs.readFileSync(leadsSourcePath, "utf-8");
    const { domains, companies } = parseCsvSource(csvContent);

    const leadIdSet = new Set<string>();

    if (domains.length) {
      const domainLeadIds = await fetchLeadIdsForDomains(domains);
      domainLeadIds.forEach((id) => leadIdSet.add(id));
    }

    if (companies.length) {
      const organizationIds = await fetchOrganizationIdsForCompanies(companies);
      if (organizationIds.length) {
        const companyLeadIds = await fetchLeadIdsForOrganizations(organizationIds);
        companyLeadIds.forEach((id) => leadIdSet.add(id));
      } else {
        logger.warn("No organizations found for provided company records");
      }
    }

    if (!leadIdSet.size) {
      throw new Error("No leads were found for the supplied CSV data");
    }

    const leadsIds = Array.from(leadIdSet);
    const enrichedLeads = await enrichLeads(leadsIds);

    createCSV(enrichedLeads);

    const exportPath = path.join(__dirname, "../../exports/leads.csv");
    const fileStream = fs.createReadStream(exportPath);
    response.status(200);
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
    fileStream.on("error", (streamError) => {
      logger.error(streamError, "Error streaming leads CSV");
      if (!response.headersSent) {
        response.status(500).end("Failed to stream leads file");
      }
    });
    fileStream.pipe(response);
  } catch (error: any) {
    logger.error(error, "Error generating leads");
    sendResponse(response, 500, "Internal Server Error", null, error?.message);
  }
};

const extractDomain = (value: string | undefined | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/^"|"$/g, "");

  if (!normalized.includes("://")) {
    normalized = `http://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    return url.hostname.replace(/^www\./i, "") || null;
  } catch {
    const fallback = normalized
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim();
    return fallback || null;
  }
};

const createCSV = (leads: any[]) => {
  const fields = [
    "Person name",
    "Title",
    "Company Name",
    "Website",
    "E-mail",
    "Phone number",
    "Location",
    "Industry",
    "Linkedin profile",
  ];

  const csvData = leads.map((lead) => {
    const emailDomain = lead.email?.split("@")[1] ?? "";
    const fallbackCompany = emailDomain ? emailDomain.split(".")[0] : "";
    const fallbackWebsite = emailDomain ? `http://${emailDomain}` : "";

    return {
      "Person name": `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
      Title: lead.title || "",
      "Company Name": lead.organization?.name || fallbackCompany,
      Website: lead.organization?.website_url || fallbackWebsite,
      "E-mail": lead.email || "",
      "Phone number": lead.organization?.phone || "",
      Location: [lead.city, lead.state, lead.country].filter(Boolean).join(", "),
      Industry: lead.organization?.industry || "",
      "Linkedin profile": lead.linkedin_url || "",
    };
  });

  const csv = parse(csvData, { fields });

  const filePath = path.join(__dirname, "../../exports/leads.csv");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, csv);

  logger.info(`CSV file created at: ${filePath}`);
};
