import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import Deals from "../../../models/Deals";
import sendResponse from "../../../utils/http/sendResponse";
import logger from "../../../logger";
import { applyStageProbabilities } from "../../../utils/deals/stageProbabilities";


// Get all deals with their contacts for a user
export const getUserDeals = async (request: JwtPayload, response: Response) => {
  try {
    const userId = request.user.id;

    const deals = await Deals.findOne({
      where: { userId },
    });
    if (deals) {
      const originalStages = deals.stages || [];
      const normalizedStages = applyStageProbabilities(originalStages);
      deals.stages = normalizedStages;
      if (
        JSON.stringify(originalStages) !== JSON.stringify(normalizedStages)
      ) {
        await deals.update({ stages: normalizedStages });
      }
    }
    sendResponse(response, 200, "Deals fetched successfully", deals);
    return;
  } catch (error: any) {
    logger.error(error, "Error fetching deals:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
