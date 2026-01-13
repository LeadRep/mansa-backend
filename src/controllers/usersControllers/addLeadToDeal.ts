import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import Deals from "../../models/Deals";
import { createDeal } from "./deals/createDeal";
import { DealContact } from "../../models/DealContacts";
import logger from "../../logger";

export const addLeadToDeal = async (
  request: JwtPayload,
  response: Response
) => {
  const userId = request.user.id;
  try {
    const { lead } = request.body;
    if (!lead) {
      sendResponse(response, 400, "Lead data is required");
      return;
    }
    const userDeal = await Deals.findOne({ where: { userId } });
    if (!userDeal) {
      createDeal(userId);
    }
    await DealContact.create({
      id: lead.id,
      deal_id: userDeal?.id,
      stage_id: userDeal?.stages[0].id,
      order_index: 0,
      external_id: lead.external_id,
      owner_id: userId,
      first_name: lead.first_name,
      last_name: lead.last_name,
      full_name: lead.full_name,
      linkedin_url: lead.linkedin_url,
      title: lead.title,
      photo_url: lead.photo_url,
      twitter_url: lead.twitter_url,
      github_url: lead.github_url,
      facebook_url: lead.facebook_url,
      headline: lead.headline,
      email: lead.email,
      phone: lead.phone,
      organization: lead.organization,
      departments: lead.departments,
      state: lead.state,
      city: lead.city,
      country: lead.country,
      category: lead.category,
      reason: lead.reason,
      score: lead.score,
    });
    sendResponse(response, 200, "Lead added to deal successfully");
    return;
  } catch (error: any) {
    logger.error(error, "Error adding lead to deal:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
