import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import Users from "../../models/Users";
import { Leads, LeadStatus } from "../../models/Leads";
import {
  updatecustomerPreference,
} from "../../utils/services/ai/updateCustomerPrefPrompt";
import { AIResponse } from "../aiControllers/customerPreference";
import logger from "../../logger";
import { step2LeadGen } from "../leadsController/step2LeadGen";

export const updateCustomerPref = async (
  request: JwtPayload,
  response: Response
) => {
  const userId = request.user.id;
  const { ICP, BP } = request.body;

  if (!ICP || !BP) {
    sendResponse(response, 400, "ICP and BP are required");
    return;
  }
  try {
    const user = await Users.findByPk(userId);
    const removeLimit = process.env.SKIP_LIMIT === "true";
    if (!removeLimit && !user?.subscriptionName) {
      sendResponse(
        response,
        400,
        "You need to have a subscription to update preferences"
      );
      return;
    }
    // const customer = await CustomerPref.findOne({ where: { userId } });
    // const newICP = {
    //   industry: ICP.industry !== customer?.ICP.industry ? ICP.industry : "",
    //   company_size:
    //     ICP.company_size !== customer?.ICP.company_size ? ICP.company_size : "",
    //   business_model:
    //     ICP.business_model !== customer?.ICP.business_model
    //       ? ICP.business_model
    //       : "",
    //   revenue: ICP.revenue !== customer?.ICP.revenue ? ICP.revenue : "",
    //   tech_stack:
    //     ICP.tech_stack !== customer?.ICP.tech_stack ? ICP.tech_stack : "",
    //   growth_stage:
    //     ICP.growth_stage !== customer?.ICP.growth_stage ? ICP.growth_stage : "",
    //   pain_points:
    //     ICP.pain_points !== customer?.ICP.pain_points ? ICP.pain_points : "",
    //   buying_triggers:
    //     ICP.buying_triggers !== customer?.ICP.buying_triggers
    //       ? ICP.buying_triggers
    //       : "",
    //   decision_making_process:
    //     ICP.decision_making_process !== customer?.ICP.decision_making_process
    //       ? ICP.decision_making_process
    //       : "",
    // };
    // const newBP = {
    //   name: BP.name !== customer?.BP.name ? BP.name : "",
    //   role: BP.role !== customer?.BP.role ? BP.role : "",
    //   similar_titles:
    //     BP.similar_titles !== customer?.BP.similar_titles
    //       ? BP.similar_titles
    //       : "",
    //   person_seniorities:
    //     BP.person_seniorities !== customer?.BP.person_seniorities
    //       ? BP.person_seniorities
    //       : "",
    //   gender: BP.gender !== customer?.BP.gender ? BP.gender : "",
    //   department:
    //     BP.department !== customer?.BP.department ? BP.department : "",
    //   age_range: BP.age_range !== customer?.BP.age_range ? BP.age_range : "",
    //   occupation:
    //     BP.occupation !== customer?.BP.occupation ? BP.occupation : "",
    //   locations: BP.locations !== customer?.BP.locations ? BP.locations : "",
    //   education: BP.education !== customer?.BP.education ? BP.education : "",
    //   responsibilities:
    //     BP.responsibilities !== customer?.BP.responsibilities
    //       ? BP.responsibilities
    //       : "",
    //   income_level:
    //     BP.income_level !== customer?.BP.income_level ? BP.income_level : "",
    //   business_model:
    //     BP.business_model !== customer?.BP.business_model
    //       ? BP.business_model
    //       : "",
    //   challenges:
    //     BP.challenges !== customer?.BP.challenges ? BP.challenges : "",
    //   goals: BP.goals !== customer?.BP.goals ? BP.goals : "",
    //   buying_power:
    //     BP.buying_power !== customer?.BP.buying_power ? BP.buying_power : "",
    //   objections:
    //     BP.objections !== customer?.BP.objections ? BP.objections : "",
    //   preferred_communication_channel:
    //     BP.preferred_communication_channel !==
    //     customer?.BP.preferred_communication_channel
    //       ? BP.preferred_communication_channel
    //       : "",
    //   motivation:
    //     BP.motivation !== customer?.BP.motivation ? BP.motivation : "",
    //   buying_trigger:
    //     BP.buying_trigger !== customer?.BP.buying_trigger
    //       ? BP.buying_trigger
    //       : "",
    // };
    // logger.info("New ICP :", newICP);
    // logger.info("New BP:", newBP);
    // const newCustomerPref = await updatecustomerPreference(
    //   user?.companyName,
    //   user?.role,
    //   user?.website,
    //   user?.country,
    //   newICP,
    //   newBP
    // );
    const customer = await CustomerPref.findOne({ where: { userId } });
    if (!customer) {
      sendResponse(response, 404, "Customer preferences not found");
      return;
    }

    const hasSubscription = Boolean(user?.subscriptionName);
    const targetLeadCount = hasSubscription ? 20 : 10;

    await customer.update({
      BP,
      ICP,
      leadsGenerationStatus: LeadsGenerationStatus.NOT_STARTED,
      aiQueryParams: null,
      currentPage: 0,
      totalPages: 0,
    });

    // Remove all existing leads so the next generation starts fresh.
    await Leads.destroy({
      where: { owner_id: userId },
    });

    sendResponse(response, 200, "Customer preferences updated successfully");

    try {
      await step2LeadGen(userId, targetLeadCount, true);
    } catch (generationError: any) {
      logger.error(
        generationError,
        "Error triggering lead generation after customer pref update"
      );
    }
    return;
  } catch (error: any) {
    logger.error(error, "Error updating customer preferences:");
    sendResponse(response, 500, "Internal Server Error", null), error.message;
    return;
  }
};
