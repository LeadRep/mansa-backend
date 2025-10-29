import axios from "axios";
import dotenv from "dotenv";
import logger from "../../logger";
dotenv.config();

export const apolloEnrichedPeople = async (ids: string[]) => {
  try {
    const enrichedData = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batchIds = ids.slice(i, i + 10);
      const batchDetails = batchIds.map((id: string) => ({ id }));
      if (!batchDetails.length) {
        continue;
      }

      const payload: Record<string, unknown> = {
        details: batchDetails,
      };

      if (
        process.env.APOLLO_REVEAL_PHONE_NUMBER &&
        process.env.APOLLO_REVEAL_PHONE_NUMBER.toLowerCase() === "true"
      ) {
        payload.reveal_phone_number = true;
      }

      try {
        const response = await axios.post(
          "https://api.apollo.io/v1/people/bulk_match",
          payload,
          {
            headers: {
              "Cache-Control": "no-cache",
              "Content-Type": "application/json",
              "x-api-key": process.env.APOLLO_API_KEY!,
            },
          }
        );
        enrichedData.push(...(response.data.matches ?? []));
      } catch (batchError: any) {
        const status = batchError?.response?.status;
        const message =
          batchError?.response?.data?.error ??
          batchError?.response?.data?.message ??
          batchError?.message ??
          "Apollo enrichment batch failed";
        logger.error(
          { status, message, batchIds },
          "Failed to enrich batch of people"
        );
      }
    }
    return enrichedData;
  } catch (error: any) {
    logger.error(error, "Error enriching people");
    throw new Error(error.message);
  }
};
