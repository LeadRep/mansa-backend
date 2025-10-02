import { Request, Response } from "express";
import { DealContact } from "../../../models/DealContacts";
import sendResponse from "../../../utils/http/sendResponse";
import { JwtPayload } from "jsonwebtoken";
import logger from "../../../logger";

// Get all contacts for a specific deal and stage
export const getContactsByDealAndStage = async (
  request: JwtPayload,
  response: Response
) => {
    const userId = request.user.id;
  try {
    const { dealId, stageId } = request.params;

    const contacts = await DealContact.findAll({
      where: {
        deal_id: dealId,
        stage_id: stageId,
        owner_id:userId
      },
      order: [["order_index", "ASC"]],
    });
    sendResponse(response, 200, "Contacts fetched successfully", contacts);
    return;
  } catch (error: any) {
    logger.error(error, "Error fetching contacts:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
