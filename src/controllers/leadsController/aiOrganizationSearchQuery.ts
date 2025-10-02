import axios from "axios";
import logger from "../../../logger";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

export const aiOrganizationSearchQuery = async (customerPref: any) => {
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful assistant that outputs only JSON. Do not include any extra text or explanations.",
    },
    {
      role: "user",
      content: `
      Based on this Ideal Customer Profile (ICP) and Buyer Persona (BP):
      ICP: ${JSON.stringify(customerPref.ICP)}
      BP: ${JSON.stringify(customerPref.BP)}
      
      Generate search parameters in JSON format that can be used to query Apollo's organization search API. Only output a valid JSON object with keys 
      organization_num_employees_ranges, organization_locations, revenue_range[max], revenue_range[min], q_organization_keyword_tags only. Do not include triple backticks or extra text.
        
      note the following
      * organization_num_employees_ranges[] array of strings
      The number range of employees working for the company. This enables you to find companies based on headcount. You can add multiple ranges to expand your search results.
      Each range you add needs to be a string, with the upper and lower numbers of the range separated only by a comma. Examples: 1,10; 250,500; 10000,20000
      * organization_locations[] array of strings
      The location of the company headquarters. You can search across cities, US states, and countries.
      If a company has several office locations, results are still based on the headquarters location. For example, if you search chicago but a company's HQ location is in boston, any Boston-based companies will not appearch in your search results, even if they match other parameters.
      To exclude companies based on location, use the organization_not_locations parameter.Examples: texas; tokyo; spain
      * revenue_range[min] integer
      Search for organizations based on their revenue.Use this parameter to set the lower range of organization revenue. Use the revenue_range[max] parameter to set the upper range of revenue.
      Do not enter currency symbols, commas, or decimal points in the figure. Example: 300000
      * revenue_range[max] integer
      Search for organizations based on their revenue. Use this parameter to set the upper range of organization revenue. Use the revenue_range[min] parameter to set the lower range of revenue.
      Do not enter currency symbols, commas, or decimal points in the figure. Example: 50000000
      * q_organization_keyword_tags[] array of strings
      Filter search results based on keywords associated with companies. For example, you can enter mining as a value to return only companies that have an association with the mining industry.
      Examples: mining; sales strategy; consulting
      `,
    },
  ];

  const response = await axios.post(
    endpoint!,
    {
      messages,
      temperature: 0.7,
      max_tokens: 500,
      model: "gpt-4",
    },
    {
      headers: {
        "api-key": apiKey!,
        "Content-Type": "application/json",
      },
    }
  );

  let content = response.data.choices[0].message.content.trim();

  // Optional cleanup if OpenAI still wraps output in code blocks
  if (content.startsWith("```")) {
    content = content
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(content);

    return parsed;
  } catch (err) {
    logger.error(err, `Failed to parse JSON from Azure AI. Content: ${content}`);
    throw new Error("Azure AI did not return valid JSON");
  }
};
