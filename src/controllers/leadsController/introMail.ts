import logger from "../../logger";
import { aiService } from "../../utils/http/services/aiService";

export type IntroMail = {
  subject: string;
  body: string;
};

export type IntroMailSender = {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
};

const safeTrim = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const getSenderDisplay = (sender?: IntroMailSender | null) => {
  const firstName = safeTrim(sender?.firstName);
  const lastName = safeTrim(sender?.lastName);
  const companyName = safeTrim(sender?.companyName);
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    fullName: fullName || "First name Last name",
    companyName: companyName || "Company",
  };
};

const applySenderSignature = (
  body: string,
  sender?: IntroMailSender | null
): string => {
  const signature = getSenderDisplay(sender);
  const normalizedBody = safeTrim(body);

  const normalizedLines = normalizedBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const isSignatureLine = (line: string) => {
    const lower = line.toLowerCase();
    return (
      lower === "best regards," ||
      lower === "best regards" ||
      lower === "[first name last name] / [title] / [company]" ||
      lower === "first name last name" ||
      lower === "company" ||
      lower === "title" ||
      (lower.includes("/") && lower.includes("title")) ||
      lower.includes("[first name last name]") ||
      lower.includes("[company]")
    );
  };

  // If a sign-off already exists, remove it and everything after.
  const lastBestRegardsIndex = normalizedLines
    .map((line) => line.toLowerCase())
    .lastIndexOf("best regards,");
  const lastBestRegardsNoCommaIndex = normalizedLines
    .map((line) => line.toLowerCase())
    .lastIndexOf("best regards");
  const signOffIndex = Math.max(lastBestRegardsIndex, lastBestRegardsNoCommaIndex);
  if (signOffIndex >= 0) {
    normalizedLines.splice(signOffIndex);
  }

  while (normalizedLines.length && isSignatureLine(normalizedLines[normalizedLines.length - 1])) {
    normalizedLines.pop();
  }

  const bodyWithoutOldSignature = normalizedLines.join("\n").trim();

  return [
    bodyWithoutOldSignature,
    "",
    "Best regards,",
    signature.fullName,
    signature.companyName,
  ]
    .join("\n")
    .trim();
};

const getRoleOrCompanyType = (lead: any): string => {
  const title = safeTrim(lead?.title);
  const industry = safeTrim(lead?.organization?.industry);
  if (title) return title;
  if (industry) return `${industry} teams`;
  return "growth teams";
};

const getOutcome = (customer: any): string => {
  const bp = customer?.BP || {};
  const icp = customer?.ICP || {};
  const candidates = [
    safeTrim(bp?.goals),
    safeTrim(bp?.painPoints),
    safeTrim(icp?.keyMetrics),
    safeTrim(icp?.valueProposition),
  ].filter(Boolean);

  return candidates[0] || "better-qualified pipeline";
};

const getObservation = (lead: any): string => {
  const company = safeTrim(lead?.organization?.name);
  const title = safeTrim(lead?.title);
  if (company && title) {
    return `you are leading ${title} initiatives at ${company}`;
  }
  if (company) {
    return `${company} appears to be growing and refining outbound execution`;
  }
  return "teams at your stage often struggle with lead quality and follow-up prioritization";
};

export const buildIntroMailFallback = (
  lead: any,
  customer: any,
  sender?: IntroMailSender | null
): IntroMail => {
  const firstName = safeTrim(lead?.first_name) || "there";
  const roleOrCompanyType = getRoleOrCompanyType(lead);
  const measurableOutcome = getOutcome(customer);
  const observation = getObservation(lead);
  const target = safeTrim(customer?.BP?.targetAudience) || "sales and growth teams";
  const keyResult = safeTrim(customer?.BP?.goals) || "higher conversion from outreach";
  const friction = safeTrim(customer?.BP?.painPoints) || "manual lead research and scattered follow-ups";

  const subject = `Helping ${roleOrCompanyType} with ${measurableOutcome}`;
  const body = [
    `Hi ${firstName},`,
    "",
    `Noticed ${observation} and thought it might be relevant.`,
    "",
    `At LeadRep, we help ${target} achieve ${keyResult} without ${friction}.`,
    "",
    "LeadRep is an AI tool that generates leads, drafts emails, auto-updates contacts, prioritizes leads, and surfaces the right follow-ups.",
    "",
    "Open to a 3-minute intro call to see if this is relevant?",
  ].join("\n");

  return { subject, body: applySenderSignature(body, sender) };
};

export const normalizeIntroMail = (
  introMail: unknown,
  lead: any,
  customer: any,
  sender?: IntroMailSender | null
): IntroMail => {
  const fallback = buildIntroMailFallback(lead, customer, sender);
  const subject = safeTrim((introMail as any)?.subject);
  const body = safeTrim((introMail as any)?.body);

  return {
    subject: subject || fallback.subject,
    body: applySenderSignature(body || fallback.body, sender),
  };
};

export const generateIntroMailForLead = async (
  customer: any,
  lead: any,
  sender?: IntroMailSender | null
): Promise<IntroMail> => {
  const senderDisplay = getSenderDisplay(sender);
  try {
    const messages = [
      {
        role: "system",
        content:
          "You generate concise B2B intro emails and output only JSON with double-quoted keys.",
      },
      {
        role: "user",
        content: `Using this ICP and Buyer Persona:\nICP: ${JSON.stringify(
          customer?.ICP
        )}\nBP: ${JSON.stringify(customer?.BP)}\n\nSender details:\n${JSON.stringify(
          senderDisplay
        )}\n\nGenerate ONE intro email for this lead:\n${JSON.stringify(
          lead
        )}\n\nReturn only JSON object with this shape:\n{\n  \"subject\": \"string\",\n  \"body\": \"string\"\n}\n\nTemplate guidance:\n- Subject should match: Helping {{role/company type}} with {{measurable outcome}}\n- Greeting line: Hi {{first name}}\n- Include a short observation hook\n- Include a short value proposition\n- Include one-line CTA for a 3-minute intro call\n- Include signature placeholder with First name Last name / Company`,
      },
    ];

    const response = await aiService.request(
      {
        messages,
        max_tokens: 1200,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }
    );

    return normalizeIntroMail(response.data, lead, customer, sender);
  } catch (error: any) {
    logger.error(error, "Error generating intro mail for lead");
    return buildIntroMailFallback(lead, customer, sender);
  }
};
