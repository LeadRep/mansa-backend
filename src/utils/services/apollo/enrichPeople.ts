import axios from "axios";
import { EnrichPersonQuery } from "./enrichPerson";

export interface EnrichPeopleQuery {
  details: EnrichPersonQuery[];
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  webhook_url?: string;
}

export const enrichPeople = async (searchParams: EnrichPeopleQuery) => {
  try {
    const response = await axios.post(
      "https://api.apollo.io/v1/people/bulk_match",
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
    console.error("Error in enrichPeople:", err.message);
    throw new Error("Failed to enrich people data");
  }
};
