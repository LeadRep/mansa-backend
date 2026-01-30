import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../../utils/http/sendResponse";
import logger from "../../../logger";

export const uploadDealContactPhoto = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const file = (request as any).file as Express.Multer.File | undefined;
    if (!file) {
      sendResponse(response, 400, "Image file is required");
      return;
    }

    const url = `/uploads/deals/${file.filename}`;
    sendResponse(response, 200, "Upload successful", { url });
  } catch (error: any) {
    logger.error(error, "Error uploading deal contact photo:");
    sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
