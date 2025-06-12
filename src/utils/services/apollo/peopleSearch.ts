import axios from "axios";

interface PeopleSearchQuery {
  person_titles: string[];
  person_locations?: string[];
  person_seniorities?: string[];
  organization_locations?: string[];
  q_organization_domains_list?: string[];
  organization_ids?: string[];
  organization_num_employees_ranges?: string[];
  q_keywords?: string;
}

export const peopleSearch = async (query: PeopleSearchQuery, page?: number) => {
  try {
    const response = await axios.post(
      "https://api.apollo.io/v1/mixed_people/search",
      {
        ...query,
        include_similar_titles: true,
        contact_email_status: ["verified", "likely to engage"],
        page: page ? page : 1,
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
  } catch (error: any) {
    console.error("Error in peopleSearch:", error.message);
    throw new Error("Failed to perform people search");
  }
};
