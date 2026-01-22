<<<<<<< HEAD
import axios from "axios";
import logger from "../../../logger";

export interface EnrichPersonQuery {
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  hashed_email?: string;
  organization_name?: string;
  domain?: string;
  id?: string;
  linkedin_url?: string;
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  webhook_url?: string;
}

export const enrichPerson = async (searchParams: EnrichPersonQuery) => {
  try {
    const response = await axios.post(
      "https://api.apollo.io/v1/people/match",
      searchParams,
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
    logger.error(err, "Error in enrichPeople:");
    throw new Error("Failed to enrich people data");
  }
};
=======
import logger from "../../../logger";
import {apolloService} from "../../http/services/apolloService";

export interface EnrichPersonQuery {
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  hashed_email?: string;
  organization_name?: string;
  domain?: string;
  id?: string;
  linkedin_url?: string;
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  webhook_url?: string;
}

export const enrichPerson = async (searchParams: EnrichPersonQuery) => {
  try {
    const response = await apolloService.request(
      "people/match",
      searchParams
    );
    return response.data;
  } catch (err: any) {
    logger.error(err, "Error in enrichPeople:");
    throw new Error("Failed to enrich people data");
  }
};
>>>>>>> master
