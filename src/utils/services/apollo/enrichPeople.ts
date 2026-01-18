import { EnrichPersonQuery } from "./enrichPerson";
import logger from "../../../logger";
import {apolloService} from "../../http/services/apolloService";

export interface EnrichPeopleQuery {
  details: EnrichPersonQuery[];
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  webhook_url?: string;
}

export const enrichPeople = async (searchParams: EnrichPeopleQuery, attempt = 1): Promise<any> => {
  try {

    const response = await apolloService.request(
      "people/bulk_match",
      searchParams
    );
    return response.data;
  } catch (error: any) {
    logger.error(error, "Error in enrichPeople:");
    throw error;
  }
};
