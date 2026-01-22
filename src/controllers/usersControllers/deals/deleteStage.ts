import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../../utils/http/sendResponse";
import Deals from "../../../models/Deals";
import { DealContact } from "../../../models/DealContacts";
import logger from "../../../logger";

export const deleteStage = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const userId = request.user.id;
    const { dealId, stageId } = request.params;
    const deal = await Deals.findOne({ where: { userId, id: dealId } });
    if (!deal) {
      sendResponse(response, 404, "Deal not found");
      return;
    }

    const remainingStages = (deal.stages || []).filter(
      (stage: any) => stage.id !== stageId
    );
    if (remainingStages.length === (deal.stages || []).length) {
      sendResponse(response, 404, "Stage not found");
      return;
    }

    if (!remainingStages.length) {
      sendResponse(response, 400, "Cannot delete the last stage");
      return;
    }

    const deletedCount = await DealContact.destroy({
      where: {
        deal_id: dealId,
        stage_id: stageId,
        owner_id: userId,
      },
    });

    await deal.update({ stages: remainingStages });

    sendResponse(response, 200, "Stage deleted successfully", {
      stages: remainingStages,
      deletedCount,
    });
  } catch (error: any) {
    logger.error(error, "Error deleting stage:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
