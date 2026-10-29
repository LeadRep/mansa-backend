import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Parser } from "json2csv";
import logger from "../logger";
import { aiService } from "../utils/http/services/aiService";
import { apolloService } from "../utils/http/services/apolloService";

dotenv.config();

interface CliArgs {
  targetCount: number;
  outputFile: string;
  query: string;
}

const parseCliArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  let targetCount = 600;
  let outputFile = path.resolve(process.cwd(), "exports/etf_sales_london_600_leads.csv");
  let query =
    "I am looking for ETF Sales working in Asset Management, Head, Director, Vice president In London";

  for (const arg of args) {
    if (arg.startsWith("--count=")) {
      const parsed = parseInt(arg.replace("--count=", ""), 10);
      if (!isNaN(parsed) && parsed > 0) targetCount = parsed;
    } else if (arg.startsWith("--out=")) {
      outputFile = path.resolve(process.cwd(), arg.replace("--out=", ""));
    } else if (arg.startsWith("--query=")) {
      query = arg.replace("--query=", "");
    }
  }

  return { targetCount, outputFile, query };
};

const normalizeSeniority = (seniority: string): string => {
  const s = seniority.toLowerCase().trim();
  if (s.includes("vp") || s.includes("vice president")) return "vp";
  if (s.includes("director")) return "director";
  if (s.includes("head")) return "head";
  if (s.includes("c_suite") || s.includes("cxo") || s.includes("chief")) return "c_suite";
  if (s.includes("manager")) return "manager";
  if (s.includes("senior")) return "senior";
  return s;
};

export const generateApolloPayloadWithAI = async (userPrompt: string) => {
  console.log("\n=======================================================");
  console.log("🤖 Step 1: Generating Apollo Search Payload with AI...");
  console.log("=======================================================");
  console.log(`Prompt: "${userPrompt}"\n`);

  const messages = [
    {
      role: "system",
      content: `You are an expert CRM and B2B lead generation assistant for Apollo.io.
Your goal is to translate a user lead search request into the optimal Apollo Mixed People Search API payload.
You must return a strictly valid JSON object without any Markdown formatting or code fences.

The JSON schema must be:
{
  "person_titles": string[],
  "person_seniorities": string[],
  "person_locations": string[],
  "q_organization_keyword_tags": string[],
  "include_similar_titles": boolean
}

Guidelines:
1. person_titles: Since niche titles (like ETF sales in a single city) have limited headcounts, provide an exhaustive, rich array of titles spanning both:
   - Primary ETF sales titles: e.g. "ETF Sales", "Head of ETF Sales", "Director ETF Sales", "VP ETF Sales", "Head of ETF Distribution", "Director ETF Distribution", "ETF Specialist", "ETF Business Development", "Exchange Traded Funds Sales", "ETF Client Coverage"
   - Closely related Asset Management sales leadership titles to ensure high volume: e.g. "Asset Management Sales", "Sales Director Asset Management", "Head of Asset Management Sales", "VP Asset Management Sales", "Head of Institutional Sales", "Institutional Sales Director", "VP Institutional Sales", "Head of Distribution", "Distribution Director", "Fund Sales Director", "Head of Fund Sales"
2. person_seniorities: Apollo ONLY supports the following exact values: "owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager", "senior", "entry", "intern". Convert any mention of Vice President to "vp", Director to "director", Head to "head".
3. person_locations: e.g. ["London, United Kingdom", "London"]
4. q_organization_keyword_tags: e.g. ["asset management", "investment management", "etf"]
5. include_similar_titles: true
`,
    },
    {
      role: "user",
      content: `Generate the Apollo search payload for this request: ${userPrompt}`,
    },
  ];

  let aiPayload: any = null;

  try {
    const aiResponse = await aiService.request({
      messages,
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    aiPayload = aiResponse.data;
    console.log("✅ AI generated payload successfully!");
  } catch (err: any) {
    console.warn("⚠️ AI generation failed or timed out, falling back to heuristic query generator:", err.message);
  }

  // Fallback / defaults if AI did not return complete parameters
  const defaultTitles = [
    "ETF Sales",
    "Head of ETF Sales",
    "Director ETF Sales",
    "VP ETF Sales",
    "Vice President ETF Sales",
    "Head of ETF Distribution",
    "Director ETF Distribution",
    "Head of ETF",
    "ETF Director",
    "VP ETF",
    "ETF Specialist",
    "Exchange Traded Funds",
    "ETF Business Development",
    "ETF Client Coverage",
    "Asset Management Sales",
    "Institutional Sales Asset Management",
    "Head of Asset Management Sales",
    "Sales Director Asset Management",
    "VP Asset Management Sales",
    "Director Asset Management Sales",
    "Head of Institutional Sales",
    "Institutional Sales Director",
    "VP Institutional Sales",
    "Head of Distribution",
    "Distribution Director",
    "VP Distribution",
    "Fund Sales Director",
    "Head of Fund Sales",
  ];

  const rawTitles = Array.isArray(aiPayload?.person_titles) && aiPayload.person_titles.length > 0
    ? aiPayload.person_titles
    : defaultTitles;

  // Combine AI titles with known high-yield ETF/Asset Management titles to ensure 600+ results
  const combinedTitles = Array.from(new Set([...rawTitles, ...defaultTitles]));

  const rawSeniorities = Array.isArray(aiPayload?.person_seniorities) && aiPayload.person_seniorities.length > 0
    ? aiPayload.person_seniorities
    : ["head", "director", "vp"];

  const normalizedSeniorities = Array.from(
    new Set<string>(rawSeniorities.map((s: any) => normalizeSeniority(String(s))))
  ).filter((s: string) => ["head", "director", "vp", "c_suite", "partner", "manager"].includes(s));

  const finalPayload = {
    person_titles: combinedTitles,
    person_seniorities: normalizedSeniorities.length ? normalizedSeniorities : ["head", "director", "vp"],
    person_locations: Array.isArray(aiPayload?.person_locations) && aiPayload.person_locations.length > 0
      ? aiPayload.person_locations
      : ["London, United Kingdom", "London"],
    q_organization_keyword_tags: Array.isArray(aiPayload?.q_organization_keyword_tags) && aiPayload.q_organization_keyword_tags.length > 0
      ? aiPayload.q_organization_keyword_tags
      : ["asset management", "investment management"],
    include_similar_titles: true,
  };

  console.log("Structured Apollo Query Payload:");
  console.log(JSON.stringify(finalPayload, null, 2));
  return finalPayload;
};

export const fetchApolloLeads = async (
  searchPayload: Record<string, any>,
  targetCount: number
) => {
  console.log("\n=======================================================");
  console.log(`🔍 Step 2: Fetching ${targetCount} leads from Apollo...`);
  console.log("=======================================================");

  const collectedLeads: any[] = [];
  const collectedIds = new Set<string>();
  const perPage = 100;
  let page = 1;
  let totalEntries = 0;

  while (collectedLeads.length < targetCount) {
    console.log(`[Page ${page}] Fetching up to ${perPage} leads from Apollo (collected: ${collectedLeads.length}/${targetCount})...`);

    try {
      const response = await apolloService.request("mixed_people/api_search", {
        ...searchPayload,
        per_page: perPage,
        page,
      });

      const data = response.data;
      if (page === 1) {
        totalEntries = Number(data?.total_entries) || 0;
        console.log(`📊 Total available leads matching criteria in Apollo: ${totalEntries}`);
        if (totalEntries === 0) {
          console.warn("No leads returned by Apollo for this search query.");
          break;
        }
      }

      const people = Array.isArray(data?.people) ? data.people : [];
      if (people.length === 0) {
        console.log("No more leads returned on this page. Stopping search pagination.");
        break;
      }

      let newLeadsInPage = 0;
      for (const person of people) {
        const id = person?.id;
        if (id && !collectedIds.has(id)) {
          collectedIds.add(id);
          collectedLeads.push(person);
          newLeadsInPage++;
          if (collectedLeads.length >= targetCount) {
            break;
          }
        }
      }

      console.log(`  -> Added ${newLeadsInPage} unique leads from page ${page}. Total collected: ${collectedLeads.length}`);

      if (collectedLeads.length >= targetCount) {
        break;
      }

      const totalPages = Math.ceil(totalEntries / perPage);
      if (page >= totalPages) {
        console.log(`Reached last page (${totalPages}). Stopping search pagination.`);
        break;
      }

      page++;
      // Brief pause to be respectful of rate limits
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      console.error(`❌ Error fetching page ${page}:`, err?.response?.data || err.message);
      break;
    }
  }

  console.log(`✅ Successfully fetched ${collectedLeads.length} unique leads from Apollo Search.`);
  return collectedLeads;
};

export const enrichApolloLeads = async (leads: any[]) => {
  console.log("\n=======================================================");
  console.log(`⚡ Step 3: Enriching ${leads.length} leads via Apollo bulk_match...`);
  console.log("=======================================================");

  const enrichedMatches: any[] = [];
  const batchSize = 10;
  const leadIds = leads.map((l) => l.id).filter(Boolean);
  const totalBatches = Math.ceil(leadIds.length / batchSize);

  console.log(`Splitting ${leadIds.length} lead IDs into ${totalBatches} batches of ${batchSize}...`);

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize) + 1;
    const batchIds = leadIds.slice(i, i + batchSize);
    const details = batchIds.map((id) => ({ id }));

    const payload: Record<string, any> = {
      details,
      reveal_personal_emails: true,
    };

    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      try {
        attempts++;
        const response = await apolloService.request("people/bulk_match", payload);
        const matches = Array.isArray(response?.data?.matches) ? response.data.matches : [];
        enrichedMatches.push(...matches);
        success = true;

        if (batchIndex % 5 === 0 || batchIndex === totalBatches) {
          console.log(
            `  -> Processed batch ${batchIndex}/${totalBatches} (${enrichedMatches.length}/${leadIds.length} leads enriched)`
          );
        }
      } catch (err: any) {
        const status = err?.response?.status;
        console.warn(`  [Batch ${batchIndex}] Attempt ${attempts} failed (${status || err.message}). Retrying...`);
        if (status === 429) {
          await new Promise((r) => setTimeout(r, 2000 * attempts));
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (!success) {
      console.error(`  ❌ Failed to enrich batch ${batchIndex} after 3 attempts.`);
    }

    // Small delay between batches to stay comfortably within rate limits
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`✅ Enrichment complete! Total enriched records: ${enrichedMatches.length}`);
  return enrichedMatches;
};

export const exportToCsv = (
  rawLeads: any[],
  enrichedLeads: any[],
  outputFilePath: string
) => {
  console.log("\n=======================================================");
  console.log("💾 Step 4: Normalizing data and writing to CSV...");
  console.log("=======================================================");

  // Create a lookup by ID for enriched leads
  const enrichedMap = new Map<string, any>();
  for (const enriched of enrichedLeads) {
    const id = enriched?.id || enriched?.person_id;
    if (id) {
      enrichedMap.set(id, enriched);
    }
  }

  let verifiedEmailsCount = 0;
  let phonesCount = 0;

  const rows = rawLeads.map((raw) => {
    const enriched = enrichedMap.get(raw.id) || {};
    const org = enriched?.organization || raw?.organization || {};

    const firstName = enriched?.first_name || raw?.first_name || "";
    const lastName = enriched?.last_name || raw?.last_name || "";
    const fullName =
      enriched?.name ||
      raw?.name ||
      [firstName, lastName].filter(Boolean).join(" ");

    const email = enriched?.email || raw?.email || "";
    const emailStatus = enriched?.email_status || raw?.email_status || "";
    if (email) verifiedEmailsCount++;

    const phone =
      enriched?.phone ||
      enriched?.sanitized_phone ||
      (Array.isArray(enriched?.phone_numbers) && enriched.phone_numbers[0]?.number
        ? enriched.phone_numbers[0].number
        : "") ||
      raw?.phone ||
      "";
    if (phone) phonesCount++;

    const city = enriched?.city || raw?.city || org?.city || "";
    const state = enriched?.state || raw?.state || org?.state || "";
    const country = enriched?.country || raw?.country || org?.country || "";

    const title = enriched?.title || raw?.title || "";
    const seniority = enriched?.seniority || raw?.seniority || "";
    const company = org?.name || enriched?.company_name || "";
    const companyWebsite = org?.website_url || org?.primary_domain || "";
    const companyLinkedin = org?.linkedin_url || "";
    const companyIndustry = org?.industry || (Array.isArray(org?.industries) ? org.industries.join(", ") : "");
    const companySize = org?.estimated_num_employees || org?.organization_size || "";
    const linkedinUrl = enriched?.linkedin_url || raw?.linkedin_url || "";
    const headline = enriched?.headline || raw?.headline || "";

    return {
      "First Name": firstName,
      "Last Name": lastName,
      "Full Name": fullName,
      Title: title,
      Seniority: seniority,
      Company: company,
      Email: email,
      "Email Status": emailStatus,
      Phone: phone,
      City: city,
      State: state,
      Country: country,
      "LinkedIn URL": linkedinUrl,
      "Company Website": companyWebsite,
      "Company LinkedIn": companyLinkedin,
      "Company Industry": companyIndustry,
      "Company Size": companySize,
      Headline: headline,
      "Apollo ID": raw.id,
    };
  });

  const fields = [
    "First Name",
    "Last Name",
    "Full Name",
    "Title",
    "Seniority",
    "Company",
    "Email",
    "Email Status",
    "Phone",
    "City",
    "State",
    "Country",
    "LinkedIn URL",
    "Company Website",
    "Company LinkedIn",
    "Company Industry",
    "Company Size",
    "Headline",
    "Apollo ID",
  ];

  const parser = new Parser({ fields });
  const csvData = parser.parse(rows);
  const BOM_UTF8 = "\ufeff";
  const finalCsv = BOM_UTF8 + csvData;

  const dir = path.dirname(outputFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputFilePath, finalCsv, "utf8");

  const stats = fs.statSync(outputFilePath);
  const sizeKb = (stats.size / 1024).toFixed(1);

  console.log("\n=======================================================");
  console.log("🎉 Export Finished Successfully!");
  console.log("=======================================================");
  console.log(`📁 File saved to: ${outputFilePath}`);
  console.log(`📊 Total rows exported: ${rows.length}`);
  console.log(`📧 Leads with email: ${verifiedEmailsCount}`);
  console.log(`📞 Leads with phone: ${phonesCount}`);
  console.log(`💾 File size: ${sizeKb} KB`);
  console.log("=======================================================\n");

  return outputFilePath;
};

export const main = async () => {
  try {
    const { targetCount, outputFile, query } = parseCliArgs();
    console.log(`Target Count: ${targetCount}`);
    console.log(`Output File: ${outputFile}`);
    console.log(`Query: ${query}`);

    // 1. Generate search payload using AI
    const searchPayload = await generateApolloPayloadWithAI(query);

    // 2. Fetch leads from Apollo with pagination
    const rawLeads = await fetchApolloLeads(searchPayload, targetCount);

    if (rawLeads.length === 0) {
      console.warn("No leads to enrich. Exiting.");
      return;
    }

    // 3. Enrich leads using Apollo bulk_match in batches of 10
    const enrichedLeads = await enrichApolloLeads(rawLeads);

    // 4. Export enriched leads to CSV
    exportToCsv(rawLeads, enrichedLeads, outputFile);
  } catch (error: any) {
    logger.error(error, "Script failed:");
    console.error("❌ Fatal Script Error:", error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
