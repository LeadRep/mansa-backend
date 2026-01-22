import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../../utils/http/sendResponse";
import Deals from "../../../models/Deals";
import logger from "../../../logger";

export const updateDealStages = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const userId = request.user.id;
    const { dealId } = request.params;
    const { stages } = request.body;

    if (!Array.isArray(stages)) {
      sendResponse(response, 400, "Stages array is required");
      return;
    }

    const deal = await Deals.findOne({ where: { userId, id: dealId } });
    if (!deal) {
      sendResponse(response, 404, "Deal not found");
      return;
    }

    await deal.update({ stages });
    sendResponse(response, 200, "Stages updated successfully", stages);
  } catch (error: any) {
    logger.error(error, "Error updating deal stages:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
