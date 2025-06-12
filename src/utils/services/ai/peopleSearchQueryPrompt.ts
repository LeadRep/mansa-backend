import axios from "axios";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

export const peopleSearchQueryPrompt = async (customerPref: any) => {
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
      
      Generate search parameters in JSON format that can be used to query Apollo's people search API. Only output a valid JSON object with keys person_titles ,person_locations, person_seniorities, organization_num_employees_ranges, organization_locations only. Do not include triple backticks or extra text.

      note the following
      * person_titles[] array of strings
      Job titles held by the people you want to find. For a person to be included in search results, they only need to match 1 of the job titles you add. Adding more job titles expands your search results.
      Results also include job titles with the same terms, even if they are not exact matches. For example, searching for marketing manager might return people with the job title content marketing manager.
      Use this parameter in combination with the person_seniorities[] parameter to find people based on specific job functions and seniority levels. Examples: sales development representative; marketing manager; research analyst
      * person_locations[] array of strings
      The location where people live. You can search across cities, US states, and countries.
      To find people based on the headquarters locations of their current employer, use the organization_locations parameter. Examples: california; ireland; chicago
      * person_seniorities[] array of strings
      The job seniority that people hold within their current employer. This enables you to find people that currently hold positions at certain reporting levels, such as Director level or senior IC level.
      For a person to be included in search results, they only need to match 1 of the seniorities you add. Adding more seniorities expands your search results.
      Searches only return results based on their current job title, so searching for Director-level employees only returns people that currently hold a Director-level title. If someone was previously a Director, but is currently a VP, they would not be included in your search results.
      Use this parameter in combination with the person_titles[] parameter to find people based on specific job functions and seniority levels.
      The following options can be used for this parameter: owner, founder, c_suite, partner, vp, head, director, manager, senior, entry, intern
      * organization_num_employees_ranges[] array of strings
      The number range of employees working for the person's current company. This enables you to find people based on the headcount of their employer. You can add multiple ranges to expand your search results.
      Each range you add needs to be a string, with the upper and lower numbers of the range separated only by a comma. Examples: 1,10; 250,500; 10000,20000
      * organization_locations[] array of strings
      The location of the company headquarters for a person's current employer. You can search across cities, US states, and countries.
      If a company has several office locations, results are still based on the headquarters location. For example, if you search chicago but a company's HQ location is in boston, people that work for the Boston-based company will not appear in your results, even if they match other \parameters.
      To find people based on their personal location, use the person_locations parameter. Examples: texas; tokyo; spain
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
    const result = {
      ...parsed,
      include_similar_titles: true,
      contact_email_status: ["verified", "likely to engage"],
      per_page: 10,
    };
    return result;
  } catch (err) {
    console.error("Failed to parse JSON from Azure AI:", content);
    throw new Error("Azure AI did not return valid JSON");
  }
};
