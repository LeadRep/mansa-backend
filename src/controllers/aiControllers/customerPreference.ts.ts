import axios from "axios";
import { Request, Response } from "express";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

// Define the expected structure of customer data
export interface CustomerData {
  companyName: string;
  role: string;
  website?: string;
  country: string;
}
interface ICP {
  industry: string;
  company_size: string;
  geographical_focus: string;
  business_model: string;
  revenue: string;
  tech_stack: string;
  growth_stage: string;
  pain_points: string;
  buying_triggers: string;
  decision_making_process: string;
}
interface BP {
  name: string;
  role: string;
  gender: string;
  department: string;
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
}
// Define the structure of the AI-generated response
export interface AIResponse {
  ideal_customer_profile: ICP;
  buyer_persona: BP;
}

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

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
  let websiteContent = "";
  try {
    websiteContent = await scrapeWebsiteContent(website);
  } catch (error:any) {
    console.warn("Unable to scrape website content, proceeding with website info only:", error.message);
  }

  const messages = [
    {
      role: "system",
      content:
        "You are a CRM intelligence assistant that enriches contact profiles based on company data. Your job is to analyze the company below and generate an Ideal Customer Profile (ICP) and a fictional Buyer Persona for that company's *target customers*. Do not describe the company itself. Use website content to infer the business model and target users. The result must be in valid JSON and contain no extra text or markdown.",
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

      Based on this information, generate:
      1. An *Ideal Customer Profile (ICP)* — this describes the typical organization or user that the company targets.
      2. A *fictional Buyer Persona* — a decision-maker or user inside that ICP.

      if there is no website content, search the internet for info about the website and get the content from there.
      Use the following JSON structure exactly. Use "or" only where it makes sense (e.g. in occupation or education), but *never* in the "name" or "gender" fields. If you can't infer a value, leave it as an empty string. Output valid JSON only, no text or explanation.
      {
        "ideal_customer_profile": {
          "industry": "",
          "company_size": "",
          "geographical_focus": "",
          "business_model": "",
          "revenue": "",
          "tech_stack": "",
          "growth_stage": "",
          "pain_points": "",
          "buying_triggers": "",
          "decision_making_process": ""
        },
        "buyer_persona": {
          "name": "",
          "role": "",
          "gender": "",
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
          "buying_trigger": ""
        }
      }
    
      Ensure the response is **only** valid JSON with no extra text or space. Any missing values should be an empty string.`,
    },
  ];

  try {
    const headers = { "Content-Type": "application/json", "api-key": apiKey };

    const response = await axios.post(
      `${endpoint}`,
      { messages, max_tokens: 500 },
      { headers }
    );

    let aiContent = response.data?.choices?.[0]?.message?.content?.trim();

    console.log(aiContent);
    return JSON.parse(aiContent) as AIResponse;
  } catch (error: any) {
    console.error("Error fetching AI response:", error.message);
    return null;
  }
}

export const customerPreference = async (req: Request, res: Response) => {
  const { companyName, role, website, country } = req.body;

  try {
    let insights: AIResponse | null = null;
    do {
      insights = await getCRMInsights(companyName, role, website, country);
    } while (insights === null || typeof insights !== "object");
    res.status(200).json(insights);
  } catch (error: any) {
    console.error("Error in scrapeController:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
