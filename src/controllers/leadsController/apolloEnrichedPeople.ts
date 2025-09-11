import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const apolloEnrichedPeople = async (ids: string[]) => {
  console.log("number of ids", ids.length);
  try {
    const enrichedData = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batchIds = ids.slice(i, i + 10);
      const batchDetails = batchIds.map((id: string) => ({ id }));
      const response = await axios.post(
        "https://api.apollo.io/v1/people/bulk_match",
        { details: batchDetails },
        {
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "x-api-key": process.env.APOLLO_API_KEY!,
          },
        }
      );
      enrichedData.push(...response.data.matches);
    }
    return enrichedData;
  } catch (error: any) {
    console.log("Error", error.response.data);
    throw new Error(error.message);
  }
};
