import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { DealContact } from "../../../models/DealContacts";
import { DealContactNote } from "../../../models/DealContactNotes";
import sendResponse from "../../../utils/http/sendResponse";
import logger from "../../../logger";

export const createDealContactNote = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const userId = request.user.id;
    const { contactId } = request.params;
    const comment = String(request.body?.comment || "").trim();
    const files = (((request as any).files || []) as Express.Multer.File[]) || [];

    const contact = await DealContact.findOne({
      where: { id: contactId, owner_id: userId },
    });
    if (!contact) {
      sendResponse(response, 404, "Deal lead not found");
      return;
    }

    if (!comment && (!files || files.length === 0)) {
      sendResponse(response, 400, "Comment or file is required");
      return;
    }

    const createdNotes: DealContactNote[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const fileUrl = `/uploads/deals/${file.filename}`;
        const fileName = file.originalname || path.basename(file.filename);
        const note = await DealContactNote.create({
          deal_contact_id: contactId,
          owner_id: userId,
          comment: comment || null,
          file_url: fileUrl,
          file_name: fileName,
        });
        createdNotes.push(note);
      }
    } else if (comment) {
      const note = await DealContactNote.create({
        deal_contact_id: contactId,
        owner_id: userId,
        comment,
        file_url: null,
        file_name: null,
      });
      createdNotes.push(note);
    }

    sendResponse(response, 201, "Note created successfully", createdNotes);
  } catch (error: any) {
    logger.error(error, "Error creating deal note:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
