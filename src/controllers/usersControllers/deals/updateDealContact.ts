import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { DealContact } from "../../../models/DealContacts";
import sendResponse from "../../../utils/http/sendResponse";
import logger from "../../../logger";

export const updateDealContact = async (
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

    const contact = await DealContact.findOne({
      where: { id: contactId, owner_id: userId },
    });

    if (!contact) {
      sendResponse(response, 404, "Deal lead not found");
      return;
    }

    const {
      full_name,
      first_name,
      last_name,
      title,
      email,
      phone,
      organization,
      deal_value,
    } = request.body;

    const updateData: Record<string, any> = {};

    if (typeof full_name === "string") {
      const trimmed = full_name.trim();
      updateData.full_name = trimmed || null;
      if (!first_name && !last_name && trimmed) {
        const [first, ...rest] = trimmed.split(" ");
        updateData.first_name = first;
        updateData.last_name = rest.join(" ");
      }
    }

    if (typeof first_name === "string") {
      updateData.first_name = first_name.trim() || null;
    }
    if (typeof last_name === "string") {
      updateData.last_name = last_name.trim() || null;
    }
    if (typeof title === "string") {
      updateData.title = title.trim() || null;
    }
    if (typeof email === "string") {
      updateData.email = email.trim() || null;
    }
    if (typeof phone === "string") {
      updateData.phone = phone.trim() || null;
    }
    if (organization) {
      updateData.organization = organization;
    }
    if (typeof deal_value === "number" && Number.isFinite(deal_value)) {
      updateData.deal_value = deal_value;
    } else if (typeof deal_value === "string" && deal_value.trim() !== "") {
      const parsedValue = Number(deal_value);
      if (Number.isFinite(parsedValue)) {
        updateData.deal_value = parsedValue;
      }
    }

    await contact.update(updateData);

    sendResponse(response, 200, "Deal lead updated successfully", contact);
  } catch (error: any) {
    logger.error(error, "Error updating deal lead:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
