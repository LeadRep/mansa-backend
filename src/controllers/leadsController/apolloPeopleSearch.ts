import axios from "axios";

export const apolloPeopleSearch = async (searchParams: any, page?:number) => {
  try {
    searchParams.include_similar_titles = true;
    searchParams.contact_email_status = ["verified", "likely to engage"];
    searchParams.per_page = 100;
    searchParams.page = page || 1;
    if (searchParams.organization_num_employees_ranges.length === 0) {
      delete searchParams.organization_num_employees_ranges;
    }
    if (
      searchParams["revenue_range[min]"] === "" &&
      searchParams["revenue_range[max]"] === ""
    ) {
      delete searchParams["revenue_range[min]"];
      delete searchParams["revenue_range[max]"];
    }
    if (searchParams.person_seniorities.length === 0) {
      delete searchParams.person_seniorities;
    }
    const response = await axios.post(
      "https://api.apollo.io/v1/mixed_people/search",
      { ...searchParams },
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
    console.log("Error", error.message);
    throw new Error(error.message);
  }
};
