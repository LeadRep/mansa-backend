import axios from "axios";
import logger from "../../../logger";
import {apolloService} from "../../http/services/apolloService";

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
    const response = await apolloService.request(
      "people/api_search",
      {
        ...query,
        include_similar_titles: true,
        contact_email_status: ["verified", "likely to engage"],
        page: page ? page : 1,
        per_page: 100,
      },
    );

    return response.data;
  } catch (error: any) {
    logger.error(error, "Error in peopleSearch:");
    return false
  }
};
