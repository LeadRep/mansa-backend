import {
  AIResponse,
  scrapeWebsiteContent,
} from "../../../controllers/aiControllers/customerPreference";
import dotenv from "dotenv";
import logger from "../../../logger";
import {aiService} from "../../http/services/aiService";
dotenv.config();

export async function updateCRMInsights(
  companyName: string,
  role: string,
  website: string = "N/A",
  country: string,
  ICP: any,
  BP: any
): Promise<AIResponse | null> {
  const websiteContent = await scrapeWebsiteContent(website);
  const messages = [
    {
      role: "system",
      content: `You are a CRM intelligence assistant that enriches contact profiles based on company data. You analyze the company below and update a provided JSON profile structure.
  
  Update only the fields that are empty strings (""). Do NOT change or modify any fields that already have values, just return the value as it is. The data structure consists of two parts:
  1. An Ideal Customer Profile (ICP) — this describes the *typical organization* the company targets.
  2. A fictional Buyer Persona — this represents a decision-maker inside that ICP.
  
  Return valid JSON only. No markdown or explanation.`,
    },
    {
      role: "user",
      content: `
  Company Details:
  - Company Name: ${companyName || "N/A"}
  - Role: ${role || "N/A"}
  - Website: ${website || "N/A"}
  - Country: ${country || "N/A"}
  - Website Content: ${websiteContent || "N/A"}
  
  JSON to update:
  {
    "ideal_customer_profile": {
      "industry": "${ICP.industry || ""}",
      "company_size": "${ICP.company_size || ""}",
      "revenue": "${ICP.revenue || ""}",
      "tech_stack": "${ICP.tech_stack || ""}",
      "growth_stage": "${ICP.growth_stage || ""}",
      "pain_points": "${ICP.pain_points || ""}",
      "buying_triggers": "${ICP.buying_triggers || ""}",
      "decision_making_process": "${ICP.decision_making_process || ""}"
    },
    "buyer_persona": {
      "name": "${BP.name || ""}",
      "role": "${BP.role || ""}",
      "similar_titles": "${BP.similar_titles || ""}",
      "person_seniorities": "${BP.person_seniorities || ""}",
      "gender": "${BP.gender || ""}",
      "department": "${BP.department || ""}",
      "age_range": "${BP.age_range || ""}",
      "locations": "${BP.locations || ""}",
      "responsibilities": "${BP.responsibilities || ""}",
      "income_level": "${BP.income_level || ""}",
      "business_model": "${BP.business_model || ""}",
      "challenges": "${BP.challenges || ""}",
      "goals": "${BP.goals || ""}",
      "buying_power": "${BP.buying_power || ""}",
      "objections": "${BP.objections || ""}",
      "preferred_communication_channel": "${
        BP.preferred_communication_channel || ""
      }",
      "motivation": "${BP.motivation || ""}",
      "buying_trigger": "${BP.buying_trigger || ""}"
    }
  }
  
  Only modify empty string fields. Do not remove or change the structure. Return valid JSON only.`,
    },
  ];

  try {
    const response = await aiService.request({
      messages,
      max_tokens: 2000
    });

    return response.data as AIResponse;
  } catch (error: any) {
    logger.error(error, "Error fetching AI response:");
    return null;
  }
}

export const updatecustomerPreference = async (
  companyName: string,
  role: string,
  website: string,
  country: string,
  ICP: any,
  BP: any
) => {
  try {
    let insights: AIResponse | null = null;
    do {
      insights = await updateCRMInsights(
        companyName,
        role,
        website,
        country,
        ICP,
        BP
      );
    } while (insights === null || typeof insights !== "object");
    return insights;
  } catch (error: any) {
    logger.error(error, "Error in scrapeController:");
  }
};