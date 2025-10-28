import axios, { AxiosRequestConfig } from "axios";
import dotenv from "dotenv";
import logger from "../../logger";

dotenv.config();

const APOLLO_ORG_ENRICH_URL =
  "https://api.apollo.io/v1/organizations/bulk_enrich";

interface ApolloOrganizationResponse {
  matches?: Array<Record<string, any>>;
}

const buildApolloHeaders = (): AxiosRequestConfig["headers"] => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

const sanitizeDomain = (raw: string): string | null => {
  if (!raw) {
    return null;
  }

  let candidate = raw.trim().toLowerCase();
  if (!candidate) {
    return null;
  }

  try {
    if (candidate.startsWith("http")) {
      candidate = new URL(candidate).hostname;
    }
  } catch {
    // ignore url parse errors, fall back to manual cleanup
  }

  candidate = candidate
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");

  return candidate || null;
};

/**
 * Calls Apollo's bulk organization enrichment endpoint in batches of domains.
 * Apollo expects repeated `domains[]` query params (max 10 per call).
 */
export const apolloEnrichedOrganization = async (
  domains: string[]
): Promise<Array<Record<string, any>>> => {
  const filteredDomains = domains
    .map((domain) => sanitizeDomain(domain))
    .filter((domain): domain is string => Boolean(domain));

  if (!filteredDomains.length) {
    return [];
  }

  try {
    const enrichedData: Array<Record<string, any>> = [];

    for (let index = 0; index < filteredDomains.length; index += 10) {
      const batch = filteredDomains.slice(index, index + 10);

      const response = await axios.post<ApolloOrganizationResponse>(
        APOLLO_ORG_ENRICH_URL,
        {},
        {
          headers: buildApolloHeaders(),
          params: {
            "domains[]": batch,
          },
          paramsSerializer: (params) => {
            const searchParams = new URLSearchParams();
            const values = params["domains[]"];
            if (Array.isArray(values)) {
              values.forEach((value) =>
                searchParams.append("domains[]", value?.trim())
              );
            }
            return searchParams.toString();
          },
        }
      );

      enrichedData.push(...(response.data?.matches ?? []));
    }
    console.log(enrichedData);
    return enrichedData;
  } catch (error: any) {
    const status = error?.response?.status;
    const details = error?.response?.data;
    logger.error(
      { status, details, message: error?.message },
      "Error enriching organizations with Apollo"
    );
    throw new Error(
      error?.response?.data?.message ??
        error?.message ??
        "Apollo organization enrichment failed"
    );
  }
};
