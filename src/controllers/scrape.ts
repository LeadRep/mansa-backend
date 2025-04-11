import axios from "axios";
import { Request, Response } from "express";
import puppeteer from "puppeteer";
import dotenv from 'dotenv'
dotenv.config()

// Define the expected structure of customer data
export interface CustomerData {
  companyName: string;
  role: string;
  website?: string;
  country: string;
}

// Define the structure of the AI-generated response
export interface AIResponse {
  role: string;
  department: string;
  name: string;
  age_range: string;
  occupation: string;
  locations: string;
  education: string;
  responsibilities: string;
  income_level: string;
  business_model: string;
  challenges: string;
  goals: string;
  buying_power: string;
  objections: string;
  preferred_communication_channel: string;
  motivation: string;
  buying_trigger: string;
  industry: string;
  company_size: string;
  geographical_focus: string;
  business_model_description: string;
  revenue: string;
  tech_stack: string;
  growth_stage: string;
  pain_points: string;
  buying_triggers: string;
  decision_making_process: string;
  gender: string;
}

const apiKey = process.env.OPENAI_API_KEY;
const endpoint =
  "https://mansacrm.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview";

export async function scrapeWebsiteContent(url: string): Promise<string> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });

  const content = await page.evaluate(() => {
    return document.body.innerText;
  });

  await browser.close();
  return content;
}

export async function getCRMInsights(
  companyName: string,
  role: string,
  website: string = "N/A",
  country: string
): Promise<AIResponse | null> {
  const websiteContent = await scrapeWebsiteContent(website);
  const messages = [
    {
      role: "system",
      content: "You are a specialized AI designed to enrich CRM systems by analyzing company data to generate a fitting realistic Ideal Customer Profile (ICP) organization and a fitting fictional Buyer Persona within the ideal target organization as customers the company should target. You must research and infer missing details using available company information including website content. Your response must be ONLY in *valid compact JSON* with no comments or explanation. Use structured thinking and market knowledge to complete all fields. Leave a field blank only if absolutely no information can be inferred.",
    },
    {
      role: "user",
      content: `
      Here is the company information:
      - Company Name: ${companyName || "N/A"}
      - Role: ${role || "N/A"}
      - Website: ${website || "N/A"}
      - Country: ${country || "N/A"}
      - Website Content: ${websiteContent || "N/A"}
    
      Analyze the business based on this data. Then generate a realistic Ideal Customer Profile and fictional Buyer Persona, following this exact JSON structure. Choose a fitting fictional name, gender (male or female, matching name), and infer all fields. Locations should include top 2 cities with countries, separated by a period and space. Output must be valid JSON only:
      {
        "name": "",
        "role": "",
        "gender":"",
        "department": "",
        "age_range": "",
        "occupation": "",
        "locations": "",
        "education": "",
        "responsibilities": "",
        "income_level": "",
        "business_model": "",
        "challenges": "",
        "goals": "",
        "buying_power": "",
        "objections": "",
        "preferred_communication_channel": "",
        "motivation": "",
        "buying_trigger": "",
        "industry": "",
        "company_size": "",
        "geographical_focus": "",
        "business_model_description": "",
        "revenue": "",
        "tech_stack": "",
        "growth_stage": "",
        "pain_points": "",
        "buying_triggers": "",
        "decision_making_process": ""
      }
    
      Ensure the response is **only** valid JSON with no extra text or space. Any missing values should be an empty string.`,
    },
  ];

  try {
    const headers = { "Content-Type": "application/json", "api-key": apiKey };

    const response = await axios.post(
      endpoint,
      { messages, max_tokens: 500 },
      { headers }
    );

    // Ensure response data exists before parsing
    let aiContent = response.data?.choices?.[0]?.message?.content?.trim();
    
    console.log(aiContent);
    return JSON.parse(aiContent) as AIResponse;
  } catch (error: any) {
    console.error("Error fetching AI response:", error.message);
    return null;
  }
}

export const scrapeController = async (req: Request, res: Response) => {
  const { companyName, role, website, country } = req.body;
  
  try {
    let insights: AIResponse | null = null;
    do{
      insights = await getCRMInsights(companyName, role, website, country);
    }while(insights === null || typeof insights !== 'object');
   res.status(200).json(insights);
    
  } catch (error: any) {
    console.error("Error in scrapeController:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
    
}