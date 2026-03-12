import { CustomerPref } from "../../models/CustomerPref";
import logger from "../../logger";
import {aiService} from "../../utils/http/services/aiService";
import { IntroMailSender } from "./introMail";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;
export const aiEvaluatedLeads = async (
  customers: any,
  people: any[],
  sender?: IntroMailSender | null
) => {
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
        Sender: ${JSON.stringify(sender || {})}
        Evaluate this lead: ${JSON.stringify(people)}
    
        Return a JSON array of objects with these fields for the provided leads:
        - id
        - category (one of: "fit", "high score", "news", "event")
        - reason (a one-sentence reason why this lead is a good fit, aligned with the category)
        - score (a number between 0 and 100)
        - intro_mail: { subject: string, body: string }
          - subject format: Helping {{role/company type}} with {{measurable outcome}}
          - body must include:
            - greeting: Hi {{first name}}
            - short observation/hook relevant to the lead/company
            - short value proposition tied to ICP/BP
            - offering description
            - one-line CTA for a 3-minute intro call
            - signature placeholder:
              ${sender?.firstName || "First name"} ${sender?.lastName || "Last name"}
              ${sender?.companyName || "Company"}
        Only return a valid JSON object. No extra text or explanations. Ensure all property names are double-quoted and the JSON is complete.
        `,
      },
    ];

    const response = await aiService.request(
      {
        messages,
        max_tokens: 5000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }
    );

    return response.data;
  } catch (error: any) {
    logger.error(error, "Error evaluating leads with ai:");
    throw new Error(error.message);
  }
};
