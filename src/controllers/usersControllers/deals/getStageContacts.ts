import { Request, Response } from "express";
import { DealContact } from "../../../models/DealContacts";
import Deals from "../../../models/Deals";
import sendResponse from "../../../utils/http/sendResponse";
import { JwtPayload } from "jsonwebtoken";
import logger from "../../../logger";
import { applyStageProbabilities } from "../../../utils/deals/stageProbabilities";

// Get all contacts for a specific deal and stage
export const getContactsByDealAndStage = async (
  request: JwtPayload,
  response: Response
) => {
    const userId = request.user.id;
  try {
    const { dealId, stageId } = request.params;

    const deal = await Deals.findOne({ where: { id: dealId, userId } });
    const stages = applyStageProbabilities(deal?.stages || []);
    const stageProbability =
      stages.find((stage: any) => stage.id === stageId)?.probability ?? 0;

    const contacts = await DealContact.findAll({
      where: {
        deal_id: dealId,
        stage_id: stageId,
        owner_id:userId
      },
      order: [["order_index", "ASC"]],
    });
    const enriched = contacts.map((contact: any) => {
      const dealValue = Number(contact.deal_value ?? 0);
      const weightedValue = Math.round((dealValue * stageProbability) / 100);
      return {
        ...contact.toJSON?.() ?? contact,
        stage_probability: stageProbability,
        weighted_value: weightedValue,
      };
    });
    sendResponse(response, 200, "Contacts fetched successfully", enriched);
    return;
  } catch (error: any) {
    logger.error(error, "Error fetching contacts:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
