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

export async function scrapeWebsiteContent(url: string) {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    const content = await page.evaluate(() => {
      return document.body.innerText;
    });

    await browser.close();
    return content;
  } catch (error: any) {
    console.log("Error scraping website content:", error.message);
    return null;
  }
}

// New helper: Fallback web search using OpenAI
async function searchAndDescribeCompany(
  companyName: string,
  website: string
): Promise<string> {
  try {
    const prompt = `Search the internet and summarize what this company does based on its website or public data.
    Company Name: ${companyName}
    Website: ${website}
    
    Return a summary of what the company does, its industry, business model, and target customers in plain text.`;

    const headers = { "Content-Type": "application/json", "api-key": apiKey };

    const response = await axios.post(
      `${endpoint}`,
      {
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that finds company information from the web.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      },
      { headers }
    );

    const content = response.data?.choices?.[0]?.message?.content?.trim();
    return content || "";
  } catch (error: any) {
    console.error("Fallback web search failed:", error.message);
    return "";
  }
}

export async function getCRMInsights(
  companyName: string,
  role: string,
  website: string = "N/A",
  country: string
): Promise<AIResponse | null> {
  let websiteContent: string | null = "";

  try {
    websiteContent = await scrapeWebsiteContent(website);
  } catch (error: any) {
    console.warn("Website scraping failed:", error.message);
  }

  // If Puppeteer fails or returns empty content, fallback to AI-powered web search
  if (!websiteContent || websiteContent.trim() === "") {
    console.log("Using fallback content from OpenAI search...");
    websiteContent = await searchAndDescribeCompany(companyName, website);
  }

  const messages = [
    {
      role: "system",
      content: `You are a CRM intelligence assistant that enriches contact profiles. Based on the company information below, generate an ICP and Buyer Persona for the company's *target customer*.
Use website content to infer business model and audience. Only return valid JSON with no markdown.`,
    },
    {
      role: "user",
      content: `
Company Name: ${companyName || "N/A"}
Role: ${role || "N/A"}
Website: ${website || "N/A"}
Country: ${country || "N/A"}
Website Content: ${websiteContent || "N/A"}

Output JSON:
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
Return valid JSON only.`,
    },
  ];

  try {
    const headers = { "Content-Type": "application/json", "api-key": apiKey };
    const response = await axios.post(
      `${endpoint}`,
      { messages, max_tokens: 500 },
      { headers }
    );

    const aiContent = response.data?.choices?.[0]?.message?.content?.trim();
    return JSON.parse(aiContent) as AIResponse;
  } catch (error: any) {
    console.error("Error getting AI response:", error.message);
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
