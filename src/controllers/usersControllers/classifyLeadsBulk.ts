import { Request, Response } from "express";
import {GeneralLeads} from "../../models/GeneralLeads";
import sendResponse from "../../utils/http/sendResponse";
import { aiClassifyLead } from "../aiControllers/testSegmentation";
import logger from "../../logger";

// Enhanced classifyLeads with bulk processing
export const classifyLeadsBulk = async (req: Request, res: Response) => {
  try {
    const batchSize = 10;

    // Get batch of unclassified leads
    const leadRecords = await GeneralLeads.findAll({
      where: {
        individual_segments: null,
        priority: 2
      },
      limit: batchSize
    });

    if (!leadRecords.length) {
      sendResponse(res, 200, "No leads to classify", []);
      return;
    }

    const leads = leadRecords.map(record => record.get({ plain: true }));

    // Process batch concurrently
    const classificationPromises = leads.map(async (lead, index) => {
      try {
        const result = await aiClassifyLead(lead);
        return { index, leadId: lead.id, result };
      } catch (error: any) {
        logger.error(error, `Failed to classify lead ${lead.id}`);
        return { index, leadId: lead.id, result: null, error: error.message };
      }
    });

    const classifications = await Promise.all(classificationPromises);

    // Bulk update results
    const updatePromises = classifications
      .filter(item => item.result) // Only update successful classifications
      .map(item =>
        GeneralLeads.update(
          { individual_segments: item.result },
          { where: { id: item.leadId } }
        )
      );

    await Promise.all(updatePromises);

    sendResponse(res, 200, "Bulk leads classification completed", {
      processed: classifications.length,
      successful: classifications.filter(item => item.result).length,
      failed: classifications.filter(item => !item.result).length
    });

  } catch (error: any) {
    logger.error(error, "Error in bulk classification");
    sendResponse(res, 500, "Internal server error", null, error.message);
  }
};