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
  companyId?: string | null;
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
      lower === "best," ||
      lower === "best" ||
      lower === "best regards," ||
      lower === "best regards" ||
      lower === "regards," ||
      lower === "regards" ||
      lower === "kind regards," ||
      lower === "kind regards" ||
      lower === "thanks," ||
      lower === "thanks" ||
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
  const signOffMarkers = new Set([
    "best,",
    "best",
    "best regards,",
    "best regards",
    "regards,",
    "regards",
    "kind regards,",
    "kind regards",
    "thanks,",
    "thanks",
  ]);
  const lowerLines = normalizedLines.map((line) => line.toLowerCase());
  const signOffIndex = lowerLines.reduce((lastIndex, line, index) => {
    return signOffMarkers.has(line) ? index : lastIndex;
  }, -1);
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
    'en': 'Generate the email in English.',
    'fr': 'Generate the email in French (Français).',
    'es': 'Generate the email in Spanish (Español).',
    'de': 'Generate the email in German (Deutsch).',
    'it': 'Generate the email in Italian (Italiano).',
    'pt': 'Generate the email in Portuguese (Português).',
    'nl': 'Generate the email in Dutch (Nederlands).',
    'pl': 'Generate the email in Polish (Polski).',
    'ru': 'Generate the email in Russian (Русский).',
    'zh': 'Generate the email in Chinese (中文).',
    'ja': 'Generate the email in Japanese (日本語).',
    'ko': 'Generate the email in Korean (한국어).',
  };

  return languageMap[languageCode] || languageMap['en'];
};

const getBfsLikeAccounts = (): Set<string> => {
  const accountsEnv = process.env.BFS_LIKE_ACCOUNTS || '';
  return new Set(accountsEnv.split(',').map(id => id.trim()).filter(Boolean));
};


const buildBfsTemplate = (
  lead: any,
  customer: any,
  sender?: IntroMailSender | null
): IntroMail => {
  const firstName = safeTrim(lead?.first_name) || "Contact";
  const senderDisplay = getSenderDisplay(sender);

  const subject = "Opportunités d'Investissement Afrique de l'Ouest | Allocation Stratégique Q2 2026";

  const body = `Cher(e) ${firstName},

Dans le cadre d'échanges sur la diversification en portefeuilles émergents et frontières, je souhaite partager avec vous nos dernières convictions sur le marché de l'Afrique de l'Ouest (zone UEMOA), une région qui affiche aujourd'hui une résilience et un dynamisme accrus face à la volatilité mondiale.

En tant qu'investisseur professionnel au sein de l'UE, vous trouverez ci-dessous une sélection d'opportunités structurées répondant aux standards de transparence et de rendement exigés par vos mandats :

📊 1. OBLIGATIONS : Rendements & Résilience

Nous observons des rendements obligataires souverains en EUR particulièrement attractifs, offrant un spread significatif par rapport aux actifs "Core" de la zone Euro. Nos analyses crédit indiquent une amélioration des ratios d'endettement pour la Côte d'Ivoire et le Sénégal.

🎯 Focus : Eurobonds et émissions locales syndiquées avec garanties multilatérales

📈 2. ACTIONS : Champions Régionaux

Le marché de la BRVM présente des opportunités sur des titres à dividendes élevés, notamment dans les secteurs de l'énergie et de la finance. Les valorisations actuelles (P/E ratios) offrent une décote historique par rapport à d'autres marchés frontières.

🚀 3. PRIVATE EQUITY : Croissance Structurelle

Accès exclusif à des fonds de capital-croissance ciblant les infrastructures logistiques et la transformation digitale en Afrique de l'Ouest. Idéal pour les portefeuilles cherchant une exposition à la croissance démographique et à l'urbanisation rapide de la région.

📋 ANALYSE DE MARCHÉ & RESEARCH

Notre "West Africa Macro-Outlook – Spring 2026" présente nos prévisions de croissance du PIB, nos analyses de risque de change et l'impact des politiques monétaires locales.

📞 PROCHAINES ÉTAPES

Nous sommes à votre disposition pour organiser un Roadshow virtuel ou une rencontre dans vos bureaux afin d'approfondir ces thématiques.

Bien cordialement,

${senderDisplay.fullName}
Head of Sales & Distribution
${senderDisplay.companyName}

⚠️ INFORMATIONS RÉGLEMENTAIRES ET DISCLAIMERS (Conformité UE)

Avertissement sur les risques : Ce document est une communication marketing à destination exclusive des Investisseurs Professionnels au sens de la directive MiFID II (2014/65/UE). Il ne constitue pas un conseil en investissement, une recommandation personnalisée ou une offre de vente.

Risques liés aux marchés émergents : L'investissement dans la région Afrique de l'Ouest comporte des risques spécifiques, notamment : le risque de liquidité, la volatilité des taux de change, ainsi que des risques politiques et réglementaires. Les performances passées ne préjugent pas des performances futures. La valeur de votre investissement peut fluctuer et le capital investi n'est pas garanti.

🔒 Confidentialité : Les informations contenues dans cet e-mail sont strictement confidentielles et destinées uniquement à son destinataire. Toute diffusion non autorisée est interdite. ${senderDisplay.companyName} est agréée et régulée par l'autorité compétente.`;

  return { subject, body };
};



export const generateIntroMailForLead = async (
  customer: any,
  lead: any,
  sender?: IntroMailSender | null
): Promise<IntroMail> => {

  // Check if this is a BFS-like account
  const bfsAccounts = getBfsLikeAccounts();
  const customerId = sender?.companyId;
  logger.info(`BFS-like accounts: ${bfsAccounts.size}`);
  logger.info(`Customer ID: ${customerId}`);

  if (customerId && bfsAccounts.has(customerId)) {
    logger.info(`Using BFS template for customer: ${customerId}`);
    return buildBfsTemplate(lead, customer, sender);
  }


  const senderDisplay = getSenderDisplay(sender);
  const preferredLanguage = getPreferredLanguage(customer);
  const languageInstructions = getLanguageInstructions(preferredLanguage);

  try {
    const messages = [
      {
        role: "system",
        content:
          "You generate concise B2B intro emails and output only JSON with double-quoted keys. ${languageInstructions}",
      },
      {
        role: "user",
        content: `Using this ICP and Buyer Persona:\nICP: ${JSON.stringify(
          customer?.ICP
        )}\nBP: ${JSON.stringify(customer?.BP)}\n\nSender details:\n${JSON.stringify(
          senderDisplay
        )}\n\nGenerate ONE intro email for this lead:\n${JSON.stringify(
          lead
        )}\n\nReturn only JSON object with this shape:\n{\n  \"subject\": \"string\",\n  \"body\": \"string\"\n}\n\nTemplate guidance:\n- Subject should match: Helping {{role/company type}} with {{measurable outcome}}\n- Greeting line: Hi {{first name}}\n- Include a short observation hook\n- Include a short value proposition\n- Include one-line CTA for a 3-minute intro call\n- Include signature placeholder with First name Last name / Company\n\n${languageInstructions}`,
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
