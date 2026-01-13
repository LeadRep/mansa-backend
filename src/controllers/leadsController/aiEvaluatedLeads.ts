import axios from "axios";
import { CustomerPref } from "../../models/CustomerPref";
import logger from "../../logger";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;
export const aiEvaluatedLeads = async (customers: any, people: any[]) => {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant that evaluates leads and outputs only JSON. Do not include any extra text or explanations. Ensure all property names are double-quoted and the JSON is complete.",
      },
      {
        role: "user",
        content: `Based on this Ideal Customer Profile (ICP) and Buyer Persona (BP):
    
        ICP: ${JSON.stringify(customers?.ICP)}
        BP: ${JSON.stringify(customers?.BP)}
        Evaluate this lead: ${JSON.stringify(people)}
    
        Return a JSON array of objects with these fields for the provided leads:
        - id
        - category (one of: "fit", "high score", "news", "event")
        - reason (a one-sentence reason why this lead is a good fit, aligned with the category)
        - score (a number between 0 and 100)
        Only return a valid JSON object. No extra text or explanations. Ensure all property names are double-quoted and the JSON is complete.
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
    logger.error(error, "Error evaluating leads with ai:");
    throw new Error(error.message);
  }
};
