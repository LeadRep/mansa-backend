import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { DealContact } from "../../../models/DealContacts";
import { DealContactNote } from "../../../models/DealContactNotes";
import sendResponse from "../../../utils/http/sendResponse";
import logger from "../../../logger";

export const getDealContactNotes = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const userId = request.user.id;
    const { contactId } = request.params;

    const contact = await DealContact.findOne({
      where: { id: contactId, owner_id: userId },
    });
    if (!contact) {
      sendResponse(response, 404, "Deal lead not found");
      return;
    }

    const notes = await DealContactNote.findAll({
      where: { deal_contact_id: contactId, owner_id: userId },
      order: [["createdAt", "ASC"]],
    });

    sendResponse(response, 200, "Notes fetched successfully", notes);
  } catch (error: any) {
    logger.error(error, "Error fetching deal notes:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
