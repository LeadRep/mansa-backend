import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import Deals from "../../models/Deals";
import { Leads } from "../../models/Leads";
import { createDeal } from "./deals/createDeal";
import { DealContact } from "../../models/DealContacts";
import logger from "../../logger";
import { v4 } from "uuid";

export const addLeadToDeal = async (
  request: JwtPayload,
  response: Response
) => {
  const userId = request.user.id;
  try {
    const { lead, stageId, dealId } = request.body;
    if (!lead) {
      sendResponse(response, 400, "Lead data is required");
      return;
    }
    const dealWhere: any = { userId };
    if (dealId) {
      dealWhere.id = dealId;
    }
    let userDeal = await Deals.findOne({ where: dealWhere });
    if (!userDeal) {
      await createDeal(userId);
      userDeal = await Deals.findOne({ where: { userId } });
    }
    if (!userDeal) {
      sendResponse(response, 500, "Failed to create deal");
      return;
    }
    const normalizedStages = userDeal.stages || [];
    const preferredStage =
      normalizedStages.find((stage: any) => stage.id === stageId) ||
      normalizedStages.find(
        (stage: any) =>
          typeof stage?.name === "string" &&
          stage.name.trim().toLowerCase() === "new"
      );
    const targetStage = preferredStage || normalizedStages[0];
    if (!targetStage) {
      sendResponse(response, 400, "Stage not found");
      return;
    }
    const existingCount = await DealContact.count({
      where: {
        deal_id: userDeal.id,
        stage_id: targetStage.id,
        owner_id: userId,
      },
    });
    const existingContact = await DealContact.findOne({
      where: {
        deal_id: userDeal.id,
        owner_id: userId,
        external_id: lead.external_id || null,
        full_name: lead.full_name || null,
        email: lead.email || null,
      },
    });
    if (existingContact) {
      sendResponse(response, 200, "Lead already in deal", existingContact);
      return;
    }
    await DealContact.create({
      id: v4(),
      deal_id: userDeal.id,
      stage_id: targetStage.id,
      order_index: existingCount,
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
    if (lead.id) {
      await Leads.destroy({
        where: {
          id: lead.id,
          owner_id: userId,
        },
      });
    }
    sendResponse(response, 200, "Lead added to deal successfully");
    return;
  } catch (error: any) {
    logger.error(error, "Error adding lead to deal:");
    sendResponse(
      response,
      500,
      "Internal Server Error",
      null,
      error?.message || "Unknown error"
    );
    return;
  }
};
