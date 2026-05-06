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
    'en': 'Generate the email subject, the email body and the reason in English.',
    'fr': 'Generate the email subject, the email body and the reason in French (Français).',
    'es': 'Generate the email subject, the email body and the reason in Spanish (Español).',
    'de': 'Generate the email subject, the email body and the reason in German (Deutsch).',
    'it': 'Generate the email subject, the email body and the reason in Italian (Italiano).',
    'pt': 'Generate the email subject, the email body and the reason in Portuguese (Português).',
    'nl': 'Generate the email subject, the email body and the reason in Dutch (Nederlands).',
    'pl': 'Generate the email subject, the email body and the reason in Polish (Polski).',
    'ru': 'Generate the email subject, the email body and the reason in Russian (Русский).',
    'zh': 'Generate the email subject, the email body and the reason in Chinese (中文).',
    'ja': 'Generate the email subject, the email body and the reason in Japanese (日本語).',
    'ko': 'Generate the email subject, the email body and the reason in Korean (한국어).',
  };

  return languageMap[languageCode] || languageMap['en'];
};

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const parseAiResponse = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : parsed.leads ?? parsed.results ?? [];
    } catch {
      return [];
    }
  }
  // object
  if (Array.isArray(data.leads)) return data.leads;
  if (Array.isArray(data.results)) return data.results;
  // fallback: try to find first array property
  const arrayProp = Object.values(data).find((v) => Array.isArray(v));
  return Array.isArray(arrayProp) ? (arrayProp as any[]) : [];
};

const DEFAULT_CHUNK_SIZE = 10;

export const aiEvaluatedLeads = async (
  customers: any,
  people: any[],
  sender?: IntroMailSender | null,
  chunkSize = DEFAULT_CHUNK_SIZE
) => {
  try {
    logger.info({
      msg: "Starting aiEvaluatedLeads with customers and people data",
      peopleCount: Array.isArray(people) ? people.length : 0,
      sender: sender ? JSON.stringify(sender) : null,
    });

    const preferredLanguage = getPreferredLanguage(customers);
    const languageInstructions = getLanguageInstructions(preferredLanguage);

    const peopleChunks = chunkArray(people || [], chunkSize);
    const allResults: any[] = [];

    for (const chunk of peopleChunks) {
      const messages = [
        {
          role: "system",
          content: `You are a helpful assistant that evaluates leads and outputs only JSON. Do not include any extra text or explanations. Ensure all property names are double-quoted and the JSON is complete. ${languageInstructions}`,
        },
        {
          role: "user",
          content: `Based on this Ideal Customer Profile (ICP) and Buyer Persona (BP):

          ICP: ${JSON.stringify(customers?.ICP)}
          BP: ${JSON.stringify(customers?.BP)}
          Sender: ${JSON.stringify(sender || {})}

          Evaluate these leads (an array). IMPORTANT: return a JSON object with this shape: {"leads":[...]} where leads contains one object per input lead in the same order. Each lead object must contain: id, category (one of: "fit","high score","news","event"), reason (one sentence), score (0-100), intro_mail: { subject, body }.
          the email subject format: Helping {{role/company type}} with {{measurable outcome}}
          the email body must include a greeting, short observation/hook relevant to the lead/company, short value proposition tied to ICP/BP, an offering description, one-line CTA for a 3-minute intro call and a signature with the sender name and the sender company.
          ${languageInstructions}
          
          Leads: ${JSON.stringify(chunk)}
          

          Only return valid JSON matching this shape: {"leads":[...]}. No extra text.`,
        },
      ];

      const response = await aiService.request({
        messages,
        max_tokens: 5000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      logger.info({
        msg: "response chunk from aiEvaluatedLeads",
        chunkSize: chunk.length,
        raw: response?.data ? JSON.stringify(response.data).slice(0, 1000) : null,
      });

      const parsed = parseAiResponse(response?.data?.leads ?? response?.data);
      allResults.push(...parsed);
    }

    logger.info({
      msg: "Completed aiEvaluatedLeads",
      requested: people?.length ?? 0,
      returned: allResults.length,
    });

    return allResults;
  } catch (error: any) {
    logger.error({ msg: "Error evaluating leads with ai", error: error?.message ?? error });
    throw new Error(error?.message ?? "Unknown AI error");
  }
};
