import axios from "axios";
import { EnrichPersonQuery } from "./enrichPerson";
import logger from "../../../logger";

export interface EnrichPeopleQuery {
  details: EnrichPersonQuery[];
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  webhook_url?: string;
}

export const enrichPeople = async (searchParams: EnrichPeopleQuery, attempt = 1): Promise<any> => {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000;
  try {
    const response = await axios.post(
      "https://api.apollo.io/v1/people/bulk_match",
      searchParams,
      {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "x-api-key": process.env.APOLLO_API_KEY!,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    if (attempt >= MAX_RETRIES) {
      logger.error(error, `Final attempt failed for batch:`);
      throw new Error("Max retries reached");
    }
    if (error.response?.status === 429) {
      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      logger.info(`Rate limited. Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return enrichPeople(searchParams, attempt + 1);
    }
    logger.error(error, "Error in enrichPeople:");
    throw error;
  }
};
