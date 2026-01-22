import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { DealContact } from "../../../models/DealContacts";
import sendResponse from "../../../utils/http/sendResponse";
import logger from "../../../logger";

export const deleteDealContact = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const userId = request.user.id;
    const { contactId } = request.params;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!contactId || !uuidRegex.test(contactId)) {
      sendResponse(response, 400, "Valid contact id is required");
      return;
    }

    const deleted = await DealContact.destroy({
      where: { id: contactId, owner_id: userId },
    });

    if (!deleted) {
      sendResponse(response, 404, "Deal lead not found");
      return;
    }

    sendResponse(response, 200, "Deal lead deleted successfully");
  } catch (error: any) {
    logger.error(error, "Error deleting deal lead:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
