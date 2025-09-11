import axios from "axios";
import { CustomerPref } from "../../models/CustomerPref";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;
export const aiPeopleSearchQuery = async (userId: string) => {
  try {
    const customers = await CustomerPref.findOne({ where: { userId } });
    const data = {
      titles: customers?.BP.role,
      locations: customers?.BP.locations,
      employees_range: customers?.ICP.company_size,
      revenue: customers?.ICP.revenue,
      personSeniorities: customers?.BP.person_seniorities,
    };
    const messages = [
      {
        role: "system",
        content: `You are a CRM assistant. Your job is to read the provided data 
        and return well formatted JSON data in the specified format below. 
        Return only valid JSON without any additional comments or explanations.
        Required JSON format:
        {
          "person_titles": [],
          "organization_locations": [],
          "organization_num_employees_ranges": [],
          "revenue_range[min]": "",
          "revenue_range[max]": "",
          "person_seniorities": [],
        }
        where:
        * person_titles: array of strings separated by commas example: ["Sales Director Africa", "Sales Director EMEA", "Head of Business Development Africa", "Head of Business Development EMEA", "Sales Manager Africa", "Sales Manager EMEA"]
        * organization_locations: array of strings separated by commas example: ["Germany", "France"]
        * organization_num_employees_ranges: array of strings separated by commas example: ["1,10", "11,50", "51,100"]
        * revenue_range[min]: integer example: 50000000
        * revenue_range[max]: integer example: 50000000000
        * person_seniorities: array of strings separated by commas example: ["vp", "head", "director"]
        `,
      },
      {
        role: "user",
        content: `Here is the data: ${JSON.stringify(data)}
        Now, Based on this information, return the data in the correct format
        `,
      },
    ];
    const headers = { "Content-Type": "application/json", "api-key": apiKey };

    const response = await axios.post(
      `${endpoint}`,
      {
        messages,
        max_tokens: 2000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      },
      { headers }
    );

    let aiContent = response.data?.choices?.[0]?.message?.content?.trim();
    if (aiContent.startsWith("```")) {
      aiContent = aiContent
        .replace(/^```(?:json)?/, "")
        .replace(/```$/, "")
        .trim();
    }
    return JSON.parse(aiContent);
  } catch (error: any) {
    console.error("Error generating leads:", error);

    if (axios.isAxiosError(error)) {
      throw new Error(
        `OpenAI API error: ${error.response?.status} - ${
          error.response?.data?.error?.message || error.message
        }`
      );
    }

    throw error instanceof Error
      ? error
      : new Error("Unknown error occurred during lead generation");
  }
};
