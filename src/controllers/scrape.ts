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
      content: `You are an AI expert in B2B marketing and sales intelligence. Your task is to analyze the provided company information and infer the characteristics of its **Ideal Customer Profile (ICP)** and a key **Buyer Persona** within that ideal customer organization. Base your inferences on the company name, website, website content, and any other provided details. Ensure the response is strictly in **valid JSON format** without extra text, explanations, or markdown.`,
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
    
      Based on this information, generate an *Ideal Customer Profile (ICP)* describing the characteristics of the most likely target organization for this company, and a *Buyer Persona* representing a typical individual within that organization who would be involved in the purchasing decision.
    
      The *ICP* should include:
      - industry: (Infer the primary industry or industries the company targets)
      - company_size: (Infer the likely size range of target companies, e.g., "Small to Medium-sized Businesses (SMBs)", "Enterprise")
      - geographical_focus: (Infer the primary geographic regions the company targets)
      - business_model: (Describe the likely business model of their ideal customers, e.g., "eCommerce", "SaaS", "Manufacturing")
      - revenue: (Infer the likely revenue range of their ideal customers)
      - pain_points: (Infer the key challenges and problems faced by their ideal customers that the company's offerings might solve)
      - buying_triggers: (Infer the events or situations that might prompt their ideal customers to seek a solution like the company's)
      The *Buyer Persona* should represent a key decision-maker or influencer within the ICP organization and include:
      - name: (Generate a plausible fictional name with a matching gender - Male or Female)
      - role: (Infer their likely job title or role within the organization)
      - gender: (Must match the generated name)
      - department: (Infer the relevant department they likely belong to)
      - age_range: (Generate a plausible age range)
      - locations: (Infer the top 2 likely city, country locations. Add a fullstop with a space before the next city and country)
      - responsibilities: (Infer their key responsibilities and tasks)
      - challenges: (Infer their specific professional challenges and pain points)
      - goals: (Infer their key professional goals and objectives)
      - preferred_communication_channel: (Infer their likely preferred methods of communication for business purposes)
      - motivation: (Infer what primarily motivates them in their role)
      - decision_making_process: (Infer their likely role and influence in the purchasing process)
    
      Ensure the response is *only* valid JSON with no extra text or space. Any missing values due to lack of information should be an empty string. The JSON structure should be:
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
    do {
      insights = await getCRMInsights(companyName, role, website, country);
    } while (insights === null || typeof insights !== "object");
    res.status(200).json(insights);
  } catch (error: any) {
    console.error("Error in scrapeController:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
