import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { CustomerPref } from "../../models/CustomerPref";
import Users from "../../models/Users";
import { findLeads } from "../aiControllers/findLeads";
import { Leads, LeadStatus } from "../../models/Leads";
import {
  updateCRMInsights,
  updatecustomerPreference,
} from "../../utils/services/ai/updateCustomerPrefPrompt";
import { AIResponse } from "../aiControllers/customerPreference.ts";

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
    if (!user?.subscriptionName) {
      sendResponse(
        response,
        400,
        "You need to have a subscription to update preferences"
      );
      return;
    }
    const customer = await CustomerPref.findOne({ where: { userId } });
    const newICP = {
      industry: ICP.industry !== customer?.ICP.industry ? ICP.industry : "",
      company_size:
        ICP.company_size !== customer?.ICP.company_size ? ICP.company_size : "",
      geographical_focus:
        ICP.geographical_focus !== customer?.ICP.geographical_focus
          ? ICP.geographical_focus
          : "",
      business_model:
        ICP.business_model !== customer?.ICP.business_model
          ? ICP.business_model
          : "",
      revenue: ICP.business_model !== customer?.ICP.revenue ? ICP.revenue : "",
      tech_stack:
        ICP.tech_stack !== customer?.ICP.tech_stack ? ICP.tech_stack : "",
      growth_stage:
        ICP.growth_stage !== customer?.ICP.growth_stage ? ICP.growth_stage : "",
      pain_points:
        ICP.pain_points !== customer?.ICP.pain_points ? ICP.pain_points : "",
      buying_triggers:
        ICP.buying_triggers !== customer?.ICP.buying_triggers
          ? ICP.buying_triggers
          : "",
      decision_making_process:
        ICP.decision_making_process !== customer?.ICP.decision_making_process
          ? ICP.decision_making_process
          : "",
    };
    const newBP = {
      name: BP.name !== customer?.BP.name ? BP.name : "",
      role: BP.role !== customer?.BP.role ? BP.role : "",
      similar_titles:
        BP.similar_titles !== customer?.BP.similar_titles
          ? BP.similar_titles
          : "",
      person_seniorities: BP.name !== customer?.BP.name ? BP.name : "",
      gender: BP.name !== customer?.BP.name ? BP.name : "",
      department: BP.name !== customer?.BP.name ? BP.name : "",
      age_range: BP.name !== customer?.BP.name ? BP.name : "",
      occupation: BP.name !== customer?.BP.name ? BP.name : "",
      locations: BP.name !== customer?.BP.name ? BP.name : "",
      education: BP.name !== customer?.BP.name ? BP.name : "",
      responsibilities: BP.name !== customer?.BP.name ? BP.name : "",
      income_level: BP.name !== customer?.BP.name ? BP.name : "",
      business_model: BP.name !== customer?.BP.name ? BP.name : "",
      challenges: BP.name !== customer?.BP.name ? BP.name : "",
      goals: BP.name !== customer?.BP.name ? BP.name : "",
      buying_power: BP.name !== customer?.BP.name ? BP.name : "",
      objections: BP.name !== customer?.BP.name ? BP.name : "",
      preferred_communication_channel:
        BP.name !== customer?.BP.name ? BP.name : "",
      motivation: BP.name !== customer?.BP.name ? BP.name : "",
      buying_trigger: BP.name !== customer?.BP.name ? BP.name : "",
    };
    const newCustomerPref = await updatecustomerPreference(
      user?.companyName,
      user?.role,
      user?.website,
      user?.country,
      newICP,
      newBP
    );
    await CustomerPref.update(
      {
        BP: newCustomerPref?.buyer_persona as unknown as JSON,
        ICP: newCustomerPref?.ideal_customer_profile as unknown as JSON,
      },
      { where: { userId } }
    );
    await Leads.destroy({
      where: { owner_id: userId, status: LeadStatus.NEW },
    });
    sendResponse(response, 200, "Customer preferences updated successfully");
    findLeads(userId, 24);
    return;
  } catch (error: any) {
    console.error("Error updating customer preferences:", error);
    sendResponse(response, 500, "Internal Server Error", null), error.message;
    return;
  }
};
