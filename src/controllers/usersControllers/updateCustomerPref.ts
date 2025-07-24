import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { CustomerPref } from "../../models/CustomerPref";
import Users from "../../models/Users";
import { findLeads } from "../aiControllers/findLeads";

export const updateCustomerPref = async (
  request: JwtPayload,
  response: Response
) => {
  const userId = request.user.id;
  const { ICP, BP } = request.body;
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
    if (!ICP || !BP) {
      sendResponse(response, 400, "ICP and BP are required");
      return;
    }
    await CustomerPref.update({ BP, ICP }, { where: { userId } });
    findLeads(userId, 24);
    sendResponse(response, 200, "Customer preferences updated successfully");
    return;
  } catch (error: any) {
    console.error("Error updating customer preferences:", error);
    sendResponse(response, 500, "Internal Server Error", null), error.message;
    return;
  }
};
