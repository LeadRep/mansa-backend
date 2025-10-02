import { Request, Response } from "express";
import sendResponse from "../utils/http/sendResponse";
import axios from "axios";
import fs from "fs";
import path from "path";
import { parse } from "json2csv";
import logger from "../logger";

const resolveLeadsSourcePath = (): string => {
  const distPath = path.join(__dirname, "file.csv");
  if (fs.existsSync(distPath)) {
    return distPath;
  }
  return path.resolve(process.cwd(), "src/controllers/file.csv");
};

export const generateLeads = async (request: Request, response: Response) => {
  try {
    // get all the domains from the csv file and save in the domains array
    const leadsSourcePath = resolveLeadsSourcePath();
    const csvContent = fs.readFileSync(leadsSourcePath, "utf-8");
    const rows = csvContent.split(/\r?\n/).filter((row) => row.trim().length);
    if (!rows.length) {
      throw new Error("CSV file is empty");
    }

    const headerColumns = rows[0]
      .replace(/^\uFEFF/, "")
      .split(";")
      .map((cell) => cell.trim());
    const domainIndex = headerColumns.findIndex(
      (column) => column.toLowerCase() === "www-address"
    );

    if (domainIndex === -1) {
      throw new Error("WWW-address column not found in CSV");
    }

    const domainSet = new Set<string>();
    for (const row of rows.slice(1)) {
      const cells = row.split(";");
      const rawValue = cells[domainIndex]?.trim();
      const domain = extractDomain(rawValue);
      if (domain) {
        domainSet.add(domain);
      }
    }

    const domains = Array.from(domainSet);

    const leadsIds: string[] = [];

    // then use the domains to fetch leads from apollo api
    // send only 100 domains at a time and save their ids to leads array
    for (let i = 0; i < domains.length; i += 100) {
      const batch = domains.slice(i, i + 100);
      const searchResponse = await axios.post(
        "https://api.apollo.io/v1/mixed_people/search",
        {
          q_organization_domains_list: batch,
          person_titles: [
            "CIO",
            "Chief Investment Officer",
            "Fund Manager",
            "Manager Selection",
            "Analyst",
            "Portfolio Manager",
          ],
          include_similar_titles: true,
          contact_email_status: ["verified", "likely to engage"],
          per_page: 100,
        },
        {
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            accept: "application/json",
            "x-api-key": process.env.APOLLO_API_KEY!,
          },
        }
      );

      const people = searchResponse.data?.people ?? [];
      for (const lead of people) {
        if (lead?.id) {
          leadsIds.push(lead.id);
        }
      }
    }
    let enrichedLeads: any[] = [];
    // after fetching the leads use the ids to get their enriched data from apollo api below

    for (let i = 0; i < leadsIds.length; i += 10) {
      const batchIds = leadsIds.slice(i, i + 10);
      const batchDetails = batchIds.map((id: string) => ({ id }));
      const response = await axios.post(
        "https://api.apollo.io/v1/people/bulk_match",
        { details: batchDetails },
        {
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "x-api-key": process.env.APOLLO_API_KEY!,
          },
        }
      );
      enrichedLeads.push(...(response.data.matches ?? []));
    }
    // then save the leads to a csv file and send the file as response
    // also save the file to the exports folder
    createCSV(enrichedLeads);
    const exportPath = path.join(__dirname, "../../exports/leads.csv");
    const fileStream = fs.createReadStream(exportPath);
    response.setHeader("Content-Type", "text/csv");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="leads.csv"'
    );
    fileStream.pipe(response);
    return;
  } catch (error: any) {
    logger.error(error, "Error generating leads");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
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
    const hostname = url.hostname.replace(/^www\./i, "");
    return hostname || null;
  } catch (error) {
    return (
      normalized
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .split("/")[0]
        .trim() || null
    );
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

  const csvData = leads.map((lead) => ({
    "Person name": `${lead.first_name || ""} ${lead.last_name || ""}`,
    Title: lead.title,
    "Company Name":
      lead.organization?.name || lead.email.split("@")[1].split(".")[0],
    Website:
      lead.organization?.website_url || `http://${lead.email.split("@")[1]}`,
    "E-mail": lead.email || "",
    "Phone number": lead.organization?.phone || "",
    Location: `${lead.city || ""}, ${lead.state || ""}, ${lead.country || ""}`,
    Industry: lead.organization?.industry || "",
    "Linkedin profile": lead.linkedin_url || "",
  }));

  const csv = parse(csvData, { fields });

  const filePath = path.join(__dirname, "../../exports/leads.csv");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, csv);

  logger.info(`CSV file created at: ${filePath}`);
};
