import axios from "axios";
import {
  AIResponse,
  scrapeWebsiteContent,
} from "../../../controllers/aiControllers/customerPreference.ts";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

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
  
        Based on this information, generate profiles that describe the typical *clients or customers* of the company, not internal employees. 
        1. An *Ideal Customer Profile (ICP)* — this describes the typical organization or user that the company targets.
        2. A *fictional Buyer Persona* — a decision-maker or user inside that ICP.
  
        Use the following JSON structure exactly. Use "or" only where it makes sense (e.g. in occupation or education), but *never* in the "name" or "gender" fields. If you can't infer a value, leave it as an empty string. Output valid JSON only, no text or explanation.
        {
          "ideal_customer_profile": {
            "industry": ${ICP.industry || ""},
            "company_size": ${ICP.company_size || ""},
            "geographical_focus": ${ICP.geographical_focus || ""},
            "business_model": ${ICP.business_model || ""},
            "revenue": ${ICP.revenue || ""},
            "tech_stack": ${ICP.tech_stack || ""},
            "growth_stage": ${ICP.growth_stage || ""},
            "pain_points": ${ICP.pain_points || ""},
            "buying_triggers": ${ICP.buying_triggers || ""},
            "decision_making_process": ${ICP.decision_making_process || ""}
          },
          "buyer_persona": {
            "name": ${BP.name || ""},
            "role": ${BP.role || ""},
            "similar_titles": ${BP.similar_titles || ""},
            "person_seniorities": ${BP.person_seniorities || ""},
            "gender": ${BP.gender || ""},
            "department": ${BP.department || ""},
            "age_range": ${BP.department || "min-max"},
            "occupation": ${BP.occupation || ""},
            "locations": ${BP.locations || ""},
            "education": ${BP.education || ""},
            "responsibilities": ${BP.responsibilities || ""},
            "income_level": ${BP.income_level || ""},
            "business_model": ${BP.business_model || ""},
            "challenges": ${BP.challenges || ""},
            "goals": ${BP.goals || ""},
            "buying_power": ${BP.buying_power || ""},
            "objections": ${BP.objections || ""},
            "preferred_communication_channel": ${
              BP.preferred_communication_channel || ""
            },
            "motivation": ${BP.motivation || ""},
            "buying_trigger": ${BP.buying_trigger || ""}
          }
        }
  
        Also note that
        * industry: strings separated by commas
        Filter search results based on keywords associated with companies. For example, you can enter mining as a value to return only companies that have an association with the mining industry.
        Examples: mining; sales strategy; consulting
        * geographical_focus: strings separated by commas
        The location of the company headquarters. You can search across cities, US states, and countries.
        If a company has several office locations, results are still based on the headquarters location. For example, if you search chicago but a company's HQ location is in boston, any Boston-based companies will not appearch in your search results, even if they match other parameters.
        To exclude companies based on location, use the organization_not_locations parameter.
        Examples: texas; tokyo; spain
        * revenue[min]integer
        Search for organizations based on their revenue.
        Use this parameter to set the lower range of organization revenue. Use the revenue_range[max] parameter to set the upper range of revenue.
        Add dollar symbol and commas in the figure where necessary. Example: $300,000
        * revenue[max]integer
        Search for organizations based on their revenue.
        Use this parameter to set the upper range of organization revenue. Use the revenue_range[min] parameter to set the lower range of revenue.
        Add dollar symbol and commas in the figure where necessary. Example: $300,000
        * company_size: strings separated by commas
        The number range of employees working for the company. This enables you to find companies based on headcount. You can add multiple ranges to expand your search results.
        Each range you add needs to be a string, with the upper and lower numbers of the range separated only by - and commas should be added for very large values. 
        The different range should be separated by a comma and a space.
        Examples: 1-10, 250-500, 10,000-20,000
        always return 3 ranges for company_size:
        for ***High Net Worth Individual*** company_size should always be very large for example 500,1000,10000,20000,50000,100000,200000,500000
        * role: strings separated by commas
        Job titles held by the people you want to find. For a person to be included in search results, they only need to match 1 of the job titles you add. Adding more job titles expands your search results.
        Results also include job titles with the same terms, even if they are not exact matches. For example, searching for marketing manager might return people with the job title content marketing manager.
        Use this parameter in combination with the person_seniorities[] parameter to find people based on specific job functions and seniority levels.
        if the role is *High Net Worth Individual* then return the role of people in an organization that are likely to be decision makers or influencers for high-value purchases, such as: founder, owner, ceo, and other similar titles.
        do not return ***High Net Worth Individual*** as a role.
        Examples: sales development representative; marketing manager; research analyst
        * similar_titles: strings separated by commas
        Job titles that are similar to the primary role. This helps to broaden the search to include related positions.
        Examples: marketing director; sales executive; product manager
        * locations: strings separated by commas
        The location where people live. You can search across cities, US states, and countries.
        To find people based on the headquarters locations of their current employer, use the organization_locations parameter.
        Examples: california; ireland; chicago
        * person_seniorities: strings separated by commas
        The job seniority that people hold within their current employer. This enables you to find people that currently hold positions at certain reporting levels, such as Director level or senior IC level.
        For a person to be included in search results, they only need to match 1 of the seniorities you add. Adding more seniorities expands your search results.
        Searches only return results based on their current job title, so searching for Director-level employees only returns people that currently hold a Director-level title. If someone was previously a Director, but is currently a VP, they would not be included in your search results.
        Use this parameter in combination with the person_titles[] parameter to find people based on specific job functions and seniority levels.
        The following options can be used for this parameter: owner, founder, c_suite, partner, vp, head, director, manager, senior, entry, intern
  
        Ensure the response is **only** valid JSON with no extra text or space. Any missing values should be an empty string.`,
    },
  ];

  try {
    const headers = { "Content-Type": "application/json", "api-key": apiKey };

    const response = await axios.post(
      `${endpoint}`,
      { messages, max_tokens: 2000 },
      { headers }
    );

    let aiContent = response.data?.choices?.[0]?.message?.content?.trim();
    if (aiContent.startsWith("```")) {
      aiContent = aiContent
        .replace(/^```(?:json)?/, "")
        .replace(/```$/, "")
        .trim();
    }
    return JSON.parse(aiContent) as AIResponse;
  } catch (error: any) {
    console.error("Error fetching AI response:", error.message);
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
      insights = await updateCRMInsights(companyName, role, website, country, ICP, BP);
    } while (insights === null || typeof insights !== "object");
    return insights;
  } catch (error: any) {
    console.error("Error in scrapeController:", error.message);
  }
};
