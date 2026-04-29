import logger from "../../logger";
import {aiService} from "../../utils/http/services/aiService";
import { IntroMailSender } from "./introMail";

const safeTrim = (value: any): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const getPreferredLanguage = (customer: any): string => {
  const appSettings = customer?.appSettings;
  if (!appSettings || typeof appSettings !== 'object') {
    return 'en'; // default to English
  }

  const preferredLanguage = safeTrim(appSettings.preferredLanguage);
  return preferredLanguage || 'en'; // default to English if not specified
};

const getLanguageInstructions = (languageCode: string): string => {
  const languageMap: Record<string, string> = {
    'en': 'Generate the email and reason in English.',
    'fr': 'Generate the email and reason in French (Français).',
    'es': 'Generate the email and reason in Spanish (Español).',
    'de': 'Generate the email and reason in German (Deutsch).',
    'it': 'Generate the email and reason in Italian (Italiano).',
    'pt': 'Generate the email and reason in Portuguese (Português).',
    'nl': 'Generate the email and reason in Dutch (Nederlands).',
    'pl': 'Generate the email and reason in Polish (Polski).',
    'ru': 'Generate the email and reason in Russian (Русский).',
    'zh': 'Generate the email and reason in Chinese (中文).',
    'ja': 'Generate the email and reason in Japanese (日本語).',
    'ko': 'Generate the email and reason in Korean (한국어).',
  };

  return languageMap[languageCode] || languageMap['en'];
};

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;
export const aiEvaluatedLeads = async (
  customers: any,
  people: any[],
  sender?: IntroMailSender | null
) => {
  try {

    const preferredLanguage = getPreferredLanguage(customers);
    const languageInstructions = getLanguageInstructions(preferredLanguage);

    const messages = [
      {
        role: "system",
        content:
          `You are a helpful assistant that evaluates leads and outputs only JSON. Do not include any extra text or explanations. Ensure all property names are double-quoted and the JSON is complete. ${languageInstructions}`,
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
        
        ${languageInstructions}
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
