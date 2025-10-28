import axios from "axios";
import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import Companies, { CompaniesAttributes } from "../../models/Companies";

const APOLLO_ORG_URL = "https://api.apollo.io/v1/mixed_companies/search";

const DEFAULT_LIMIT = 100;
const DEFAULT_PER_PAGE = 25;
const BATCH_SIZE = 5;
const MAX_FAILURES_REPORTED = 10;
const MAX_RESULTS_PREVIEW = 25;

const buildApolloHeaders = () => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

const normalizeName = (value?: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase().replace(/\s+/g, " ");
};

const normalizeDomain = (value?: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  let candidate = value.trim().toLowerCase();
  if (!candidate) {
    return null;
  }

  try {
    if (candidate.startsWith("http")) {
      candidate = new URL(candidate).hostname;
    }
  } catch {
    // ignore malformed urls
  }

  candidate = candidate
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");

  return candidate || null;
};

const extractOrganization = (candidate: Record<string, any>) =>
  candidate?.organization ?? candidate ?? {};

interface MatchedOrganizationSummary {
  id: string | null;
  name: string | null;
  domain: string | null;
}

type ProcessCompanyResult =
  | { status: "skipped"; reason: string }
  | { status: "no_match"; reason?: string }
  | {
      status: "matched_no_update";
      organization: MatchedOrganizationSummary;
    }
  | {
      status: "updated";
      organization: MatchedOrganizationSummary;
      updatedFields: Array<keyof CompaniesAttributes>;
    }
  | {
      status: "error";
      error: {
        status?: number;
        message: string;
      };
    };

interface CompanyProcessingOutcome {
  companyId: string;
  companyName: string | null;
  status: ProcessCompanyResult["status"];
  reason?: string;
  organization?: MatchedOrganizationSummary;
  updatedFields?: Array<keyof CompaniesAttributes>;
  error?: {
    status?: number;
    message: string;
  };
}

const summarizeOrganization = (
  match: Record<string, any>
): MatchedOrganizationSummary => {
  const organization = extractOrganization(match);
  const id =
    typeof organization.id === "string"
      ? organization.id
      : typeof organization.organization_id === "string"
      ? organization.organization_id
      : null;
  const rawName =
    typeof organization.name === "string"
      ? organization.name
      : typeof organization.organization_name === "string"
      ? organization.organization_name
      : null;
  const name = rawName?.trim() ? rawName.trim() : null;
  const domain = normalizeDomain(
    organization.primary_domain ??
      organization.domain ??
      organization.website_url ??
      organization.website ??
      null
  );

  return { id, name, domain };
};

const buildUpdatePayload = (
  company: Companies,
  match: Record<string, any>
): Partial<CompaniesAttributes> => {
  const organization = extractOrganization(match);
  const updatePayload: Partial<CompaniesAttributes> = {};

  const externalId =
    typeof organization.id === "string"
      ? organization.id
      : typeof organization.organization_id === "string"
      ? organization.organization_id
      : null;
  if (externalId) {
    updatePayload.external_id = externalId;
  }

  const normalizedDomain = normalizeDomain(
    organization.primary_domain ??
      organization.domain ??
      organization.website_url ??
      organization.website ??
      null
  );
  const existingDomain = normalizeDomain(company.primary_domain ?? null);
  if (normalizedDomain && normalizedDomain !== existingDomain) {
    updatePayload.primary_domain = normalizedDomain;
  }

  if (
    !company.website_url &&
    typeof organization.website_url === "string" &&
    organization.website_url.trim()
  ) {
    updatePayload.website_url = organization.website_url.trim();
  }

  if (
    !company.linkedin_url &&
    typeof organization.linkedin_url === "string" &&
    organization.linkedin_url.trim()
  ) {
    updatePayload.linkedin_url = organization.linkedin_url.trim();
  }

  return updatePayload;
};

const findBestMatch = (
  company: Companies,
  candidates: any[]
): Record<string, any> | null => {
  if (!Array.isArray(candidates) || !candidates.length) {
    return null;
  }

  const companyName = normalizeName(company.name ?? null);
  const companyDomain = normalizeDomain(
    company.primary_domain ?? company.website_url ?? null
  );

  const evaluated = candidates.map((candidate) => {
    const organization = extractOrganization(candidate);
    const candidateName = normalizeName(
      organization.name ?? organization.organization_name ?? null
    );
    const candidateDomain = normalizeDomain(
      organization.primary_domain ??
        organization.domain ??
        organization.website_url ??
        organization.website ??
        null
    );

    return {
      candidate,
      domainMatches:
        Boolean(companyDomain) &&
        Boolean(candidateDomain) &&
        companyDomain === candidateDomain,
      nameMatches:
        Boolean(companyName) &&
        Boolean(candidateName) &&
        companyName === candidateName,
    };
  });

  return (
    evaluated.find((item) => item.domainMatches && item.nameMatches)?.candidate ??
    evaluated.find((item) => item.domainMatches)?.candidate ??
    evaluated.find((item) => item.nameMatches)?.candidate ??
    candidates[0] ??
    null
  );
};

const processCompany = async (
  company: Companies,
  perPage: number
): Promise<ProcessCompanyResult> => {
  const companyName =
    typeof company.name === "string" ? company.name.trim() : "";

  if (!companyName) {
    return { status: "skipped", reason: "Company name is missing" };
  }

  try {
    const response = await axios.post(
      APOLLO_ORG_URL,
      {
        q_organization_name: companyName,
      },
      { headers: buildApolloHeaders() }
    );

    const organizations =
      response.data?.organizations ?? response.data?.companies ?? [];

    if (!Array.isArray(organizations) || !organizations.length) {
      return { status: "no_match" };
    }

    const bestMatch = findBestMatch(company, organizations);
    if (!bestMatch) {
      return { status: "no_match" };
    }

    const updatePayload = buildUpdatePayload(company, bestMatch);
    if (!Object.keys(updatePayload).length) {
      return {
        status: "matched_no_update",
        organization: summarizeOrganization(bestMatch),
      };
    }

    await company.update(updatePayload);

    return {
      status: "updated",
      organization: summarizeOrganization(bestMatch),
      updatedFields: Object.keys(updatePayload) as Array<
        keyof CompaniesAttributes
      >,
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const message =
      error?.response?.data?.error ??
      error?.response?.data?.message ??
      error?.message ??
      "Apollo request failed";
    return {
      status: "error",
      error: {
        status,
        message,
      },
    };
  }
};

export const findOrganizations = async (_req: Request, res: Response) => {
  const perPage = DEFAULT_PER_PAGE;
  const limit = DEFAULT_LIMIT;

  try {
    const companies = await Companies.findAll({
      where: { external_id: null },
      limit,
    });

    if (!companies.length) {
      sendResponse(res, 200, "No companies found without external_id", {
        limit,
      });
      return;
    }

    const details: CompanyProcessingOutcome[] = [];
    const stats = {
      processed: 0,
      skipped: 0,
      updated: 0,
      matchedNoUpdate: 0,
      noMatch: 0,
      errors: 0,
    };

    for (let index = 0; index < companies.length; index += BATCH_SIZE) {
      const batch = companies.slice(index, index + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((company) => processCompany(company, perPage))
      );

      batchResults.forEach((result, resultIndex) => {
        const company = batch[resultIndex];
        const companyId = String(company.id);
        const outcome: CompanyProcessingOutcome = {
          companyId,
          companyName:
            typeof company.name === "string" ? company.name : null,
          status: result.status,
        };

        stats.processed += 1;

        switch (result.status) {
          case "skipped":
            stats.skipped += 1;
            outcome.reason = result.reason;
            break;
          case "no_match":
            stats.noMatch += 1;
            outcome.reason = result.reason;
            break;
          case "matched_no_update":
            stats.matchedNoUpdate += 1;
            outcome.organization = result.organization;
            break;
          case "updated":
            stats.updated += 1;
            outcome.organization = result.organization;
            outcome.updatedFields = result.updatedFields;
            break;
          case "error":
            stats.errors += 1;
            outcome.error = result.error;
            break;
          default:
            break;
        }

        details.push(outcome);
      });
    }

    const failures = details
      .filter((detail) => detail.status === "error")
      .slice(0, MAX_FAILURES_REPORTED);

    const updatedCompaniesPreview = details
      .filter((detail) => detail.status === "updated")
      .slice(0, MAX_RESULTS_PREVIEW)
      .map((detail) => ({
        companyId: detail.companyId,
        organization: detail.organization,
        updatedFields: detail.updatedFields,
      }));

    const resultsPreview = details.slice(0, MAX_RESULTS_PREVIEW);

    sendResponse(
      res,
      200,
      `Processed ${stats.processed} companies`,
      {
        limit,
        perPage,
        totalCandidates: companies.length,
        stats,
        updatedCompaniesPreview,
        failures,
        resultsPreview,
      }
    );
  } catch (error: any) {
    const status = error?.response?.status;
    const details = error?.response?.data;
    console.log("Error:", status, details?.error ?? error.message);
    sendResponse(
      res,
      status || 500,
      "Failed to fetch organizations",
      null,
      details?.error ?? error.message
    );
  }
};
