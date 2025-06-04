import axios from "axios";

interface organizationSearchQuery {
  organization_num_employees_ranges?: string[];
  organization_locations?: string[];
  organization_not_locations?: string[];
  "revenue_range[max]"?: number;
  "revenue_range[min]"?: number;
  currently_using_any_of_technology_uids?: string[];
  q_organization_keyword_tags?: string[];
  q_organization_name?: string;
  organization_ids?: string[];
}

export const organizationSearch = async (
  searchParams: organizationSearchQuery,
  page: number
) => {
  try {
    const response = await axios.post(
      "https://api.apollo.io/v1/mixed_companies/search",
      {
        q_organization_domains: [],
        ...searchParams,
        page,
        per_page: 100,
      },
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
  } catch (err: any) {
    console.error("Error in organizationSearch:", err.message);
    throw new Error("Failed to search organizations");
  }
};
