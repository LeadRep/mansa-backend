import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { CustomerPref } from "../../models/CustomerPref";
import logger from "../../logger";

export const userCustomerPref = async (
  request: JwtPayload,
  response: Response
) => {
  const userId = request.user.id;
  try {
    const pref = await CustomerPref.findOne({ where: { userId: userId } });
    if (!pref) {
      sendResponse(response, 400, "Not found");
      return;
    }
    sendResponse(response, 200, "successful", pref);
    return;
  } catch (error: any) {
    logger.error(error, "Error in userCustomerPref:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
