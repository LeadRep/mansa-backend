import dotenv from "dotenv";
import logger from "../../logger";
import {apolloService} from "../../utils/http/services/apolloService";
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
        const response = await apolloService.request(
          "people/bulk_match",
          payload
        )
        enrichedData.push(...(response.data.matches ?? []));
      } catch (batchError: any) {
        logger.error(
          {
            status: batchError?.status,
            message: batchError?.message ?? (batchError as Error)?.message,
            batchIds,
          },
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
