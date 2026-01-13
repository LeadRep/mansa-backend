import { CustomerPref } from "../models/CustomerPref";
import axios from "axios";
import { Leads } from "../models/Leads";
import { v4 } from "uuid";
import logger from "../logger";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

const getCustomerPrefByUserId = async (userId: string) => {
  const pref = await CustomerPref.findOne({ where: { userId } });
  if (!pref) throw new Error("Customer preferences not found");
  return pref;
};

const getSearchParametersFromAzureAI = async (customerPref: any) => {
  logger.info("getting search params...");

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
  
  Generate search parameters in JSON format that can be used to query Apollo's lead search API. Only output a valid JSON object with keys person_titles, person_locations only. Do not include triple backticks or extra text.
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
    logger.error(err, `Failed to parse JSON from Azure AI. Content: ${content}`);
    throw new Error("Azure AI did not return valid JSON");
  }
};

const searchLeadsOnApollo = async (searchParams: any) => {
  try {
    const response = await axios.post(
      "https://api.apollo.io/v1/mixed_people/search",
      {
        q_organization_domains: [],
        ...searchParams,
        page: 1,
        per_page: 10,
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

    return response.data;
  } catch (error: any) {
    logger.error(error, "Error searching leads on Apollo:");
    throw new Error("Failed to search leads on Apollo");
  }
};
const getTwentyLeads = async (searchParams: any) => {
  const page1 = await searchLeadsOnApollo({
    ...searchParams,
    page: 1,
    per_page: 10,
  });
  //   const page2 = await searchLeadsOnApollo({
  //     ...searchParams,
  //     page: 2,
  //     per_page: 10,
  //   });

  //   const combined = [...page1.people, ...page2.people];
  return page1.people;
};

const evaluateLeadsWithAI = async (customerPref: any, leads: any[]) => {
  const results = [];

  for (const lead of leads) {
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant that evaluates a single lead and outputs only JSON. Do not include any extra text or explanations. Ensure all property names are double-quoted and the JSON is complete.",
      },
      {
        role: "user",
        content: `Based on this Ideal Customer Profile (ICP) and Buyer Persona (BP):
    
  ICP: ${JSON.stringify(customerPref.ICP)}
  BP: ${JSON.stringify(customerPref.BP)}
    
  Evaluate this lead:
  ${JSON.stringify(lead)}
    
  Return a JSON object with all the lead's existing information and add these fields:
  - id
  - first_name
  - last_name
  - full_name
  - linkedin_url
  - title
  - photo_url
  - twitter_url
  - github_url
  - facebook_url
  - headline
  - email
  - phone
  - organization
  - departments
  - state
  - city
  - country
  - category (one of: "fit", "high score", "news", "event")
  - reason (a one-sentence reason why this lead is a good fit, aligned with the category)
  - score (a number between 0 and 100)
    
  Only return a valid JSON object. No extra text or explanations. Ensure all property names are double-quoted and the JSON is complete.`,
      },
    ];

    try {
      const response = await axios.post(
        endpoint!,
        {
          messages,
          temperature: 0.7,
          max_tokens: 2000,
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

      // More robust cleaning of JSON response
      content = content
        .replace(/^```(?:json)?\s*/i, "") // Remove starting markdown code block
        .replace(/\s*```$/i, "") // Remove ending markdown code block
        .trim();

      // Try to parse the JSON with error recovery
      try {
        const parsedLead = JSON.parse(content);
        results.push(parsedLead);
      } catch (innerErr: any) {
        logger.error(
          innerErr,
          `Failed to parse JSON for lead: ${lead.email}. Raw content: ${content}`,
        );

        // Attempt to fix common JSON issues
        try {
          // Fix unquoted property names
          const fixedContent = content.replace(
            /([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g,
            '$1"$2"$3'
          );
          const parsedLead = JSON.parse(fixedContent);
          results.push(parsedLead);
        } catch (fixErr: any) {
          logger.error(fixErr, "Failed to fix JSON:");
          // If we can't fix it, push the original lead with error info
          results.push({
            ...lead,
            category: "unknown",
            reason: "Could not evaluate lead due to JSON parse error",
            score: 0,
            parseError: innerErr.message,
          });
        }
      }
    } catch (err: any) {
      logger.error(err, `Failed to evaluate lead: ${lead.email}`);
      results.push({
        ...lead,
        category: "unknown",
        reason: "API call failed during evaluation",
        score: 0,
        apiError: err.message,
      });
    }
  }

  return results;
};

export const findLeadsForUser = async (userId: string) => {
  try {
    const pref = await getCustomerPrefByUserId(userId);
    const searchParams = await getSearchParametersFromAzureAI(pref);
    const leads = await getTwentyLeads(searchParams);
    const evaluatedLeads = await evaluateLeadsWithAI(pref, leads);
    for (const lead of evaluatedLeads) {
      await Leads.create({
        id: v4(),
        external_id: lead.id,
        owner_id: userId,
        first_name: lead.first_name,
        last_name: lead.last_name,
        full_name: lead.full_name,
        linkedin_url: lead.linkedin_url,
        title: lead.title,
        photo_url: lead.photo_url,
        twitter_url: lead.twitter_url,
        github_url: lead.github_url,
        facebook_url: lead.facebook_url,
        headline: lead.headline,
        email: lead.email,
        phone: lead.phone,
        organization: lead.organization,
        departments: lead.departments,
        state: lead.state,
        city: lead.city,
        country: lead.country,
        category: lead.category,
        reason: lead.reason,
        score: lead.score,
      });
    }
    return evaluatedLeads;
  } catch (error: any) {
    logger.error(error, "Error finding leads:");
    throw new Error("Failed to find leads");
  }
};
