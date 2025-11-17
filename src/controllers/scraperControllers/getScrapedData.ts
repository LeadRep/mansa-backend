import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import { scrapeAndExtract } from "../../utils/services/ai/scrapeAndExtract";
import logger from "../../logger";

export const getScrapedData = async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return sendResponse(res, 400, "URL is required.");
  }

  try {
    const extractedData = await scrapeAndExtract(url);
    return sendResponse(
      res,
      200,
      "Successfully scraped and extracted data.",
      extractedData
    );
  } catch (error: any) {
    logger.error(error, "Error in getScrapedData controller:");
    return sendResponse(
      res,
      500,
      "Failed to process URL.",
      null,
      error.message
    );
  }
};
