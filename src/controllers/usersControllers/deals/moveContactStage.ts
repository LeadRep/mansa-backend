import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { DealContact } from "../../../models/DealContacts";
import sendResponse from "../../../utils/http/sendResponse";
import logger from "../../../logger";

export const moveContactToStage = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const { contactId } = request.params;
    const { stageId, orderIndex } = request.body;

    const contact = await DealContact.findByPk(contactId);
    if (!contact) {
      sendResponse(response, 400, "Contact not found");
      return;
    }

    await contact.update({
      stage_id: stageId,
      order_index: orderIndex || 0,
    });

    sendResponse(response, 200, "Contact moved successfully", contact);
  } catch (error: any) {
    logger.error(error, "Error moving contact:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
