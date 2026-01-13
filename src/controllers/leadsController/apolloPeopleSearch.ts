import axios from "axios";
import logger from "../../logger";

type ApolloSearchParams = Record<string, any> | null | undefined;

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

    if (!effectiveParams.organization_num_employees_ranges) {
      delete effectiveParams.organization_num_employees_ranges;
    }

    const revenueMin = effectiveParams["revenue_range[min]"];
    const revenueMax = effectiveParams["revenue_range[max]"];
    if (revenueMin === "" && revenueMax === "") {
      delete effectiveParams["revenue_range[min]"];
      delete effectiveParams["revenue_range[max]"];
    }

    if (
      !Array.isArray(effectiveParams.person_seniorities) ||
      effectiveParams.person_seniorities.length === 0
    ) {
      delete effectiveParams.person_seniorities;
    }

    const response = await axios.post(
      "https://api.apollo.io/v1/mixed_people/search",
      { ...effectiveParams },
      {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          accept: "application/json",
          "x-api-key": process.env.APOLLO_API_KEY!,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    logger.error(error, "Error searching people:");
    throw new Error(error.message);
  }
};
