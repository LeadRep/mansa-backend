import logger from "../../logger";
import { normalizeEmployeeRanges } from "../../utils/normalizeEmployeeRanges";
import { apolloService } from "../../utils/http/services/apolloService";
import { persistApolloResults } from "../leadGenV2/persistApolloResults";

type ApolloSearchParams = Record<string, any> | null | undefined;

const toRevenueNumber = (value: unknown): number | undefined => {
  const parsed =
    typeof value === "string" ? Number(value.replace(/[,\s]/g, "")) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed)
    : undefined;
};

export const apolloPeopleSearch = async (
  searchParams: ApolloSearchParams,
  page?: number
) => {
  try {
    const effectiveParams: Record<string, any> = {
      ...(typeof searchParams === "object" && searchParams !== null
        ? searchParams
        : {}),
    };

    effectiveParams.include_similar_titles = true;
    // effectiveParams.contact_email_status = ["verified", "likely to engage"];
    effectiveParams.per_page = 100;
    effectiveParams.page = page || 1;

    // Saved params may contain ranges Apollo rejects (e.g. "501,1,000", "10,001+").
    const employeeRanges = normalizeEmployeeRanges(
      effectiveParams.organization_num_employees_ranges
    );
    if (employeeRanges.length) {
      effectiveParams.organization_num_employees_ranges = employeeRanges;
    } else {
      delete effectiveParams.organization_num_employees_ranges;
    }

    // Apollo ignores literal "revenue_range[min]" keys in a JSON body; they must be nested.
    const revenueMin = toRevenueNumber(effectiveParams["revenue_range[min]"]);
    const revenueMax = toRevenueNumber(effectiveParams["revenue_range[max]"]);
    delete effectiveParams["revenue_range[min]"];
    delete effectiveParams["revenue_range[max]"];
    if (revenueMin !== undefined || revenueMax !== undefined) {
      effectiveParams.revenue_range = {
        ...(revenueMin !== undefined ? { min: revenueMin } : {}),
        ...(revenueMax !== undefined ? { max: revenueMax } : {}),
      };
    }

    if (
      !Array.isArray(effectiveParams.person_seniorities) ||
      effectiveParams.person_seniorities.length === 0
    ) {
      delete effectiveParams.person_seniorities;
    }

    const response = await apolloService.request(
      "mixed_people/api_search",
      { ...effectiveParams }
    );

    const people = Array.isArray(response?.data?.people) ? response.data.people : [];
    if (people.length) {
      try {
        // Persist the full page result so all returned Apollo leads are cached.
        await persistApolloResults(people);
      } catch (persistError: any) {
        logger.error(
          { message: persistError?.message, page: effectiveParams.page },
          "Failed to persist Apollo page results to GeneralLeads"
        );
      }
    }

    return response.data;
  } catch (error: any) {
    logger.error(error, "Error searching people:");
    throw new Error(error.message);
  }
};
