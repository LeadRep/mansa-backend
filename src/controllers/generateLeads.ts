import { Request, Response } from "express";
import sendResponse from "../utils/http/sendResponse";
import axios from "axios";
import fs from "fs";
import path from "path";
import { parse } from "json2csv";

export const generateLeads = async (request: Request, response: Response) => {
  try {
    const apiResponse = await axios.post(
      "https://api.apollo.io/v1/mixed_people/search",
      {
        person_titles: [
          "Sales Director Africa",
          "Sales Director EMEA",
          "Head of Business Development Africa",
          "Head of Business Development EMEA",
          "Sales Manager Africa",
          "Sales Manager EMEA",
        ],
        // person_locations: ["Germany"],
        organization_locations: ["Germany"],
        organization_num_employees_ranges: ["1000,1000000000"],
        "revenue_range[min]": 50000000,
        "revenue_range[max]": 50000000000,
        // q_keywords:"Automotive Machinery Chemicals Consumer Goods Construction Industrial Automation Medical Devices Financial Services",
        //   "Machinery, Automotive, Chemicals, FMCG, Construction, Industrial goods, Medical goods, Finance",
        person_seniorities: ["vp", "head", "director"],
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
    const leadsIds = apiResponse.data.model_ids;
    let enrichedLeads = [];
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
      enrichedLeads.push(...response.data.matches);
    }
    // createCSV(enrichedLeads);
    sendResponse(response, 200, "Leads gotten", apiResponse.data);
    return;
  } catch (error: any) {
    console.log("Error", error.message);
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
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
    "Employee size",
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
    "Employee size": lead.organization?.estimated_num_employees || "",
  }));

  const csv = parse(csvData, { fields });

  const filePath = path.join(__dirname, "../../exports/leads.csv");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, csv);

  console.log(`CSV file created at: ${filePath}`);
};
