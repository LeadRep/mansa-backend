import { Request, Response } from "express";
import {GeneralLeads} from "../../models/GeneralLeads";
import sendResponse from "../../utils/http/sendResponse";
import { aiClassifyLead } from "../aiControllers/testSegmentation";
import logger from "../../logger";

export const classifyLeads = async (req: Request, res: Response) => {
  try {
    //const userId = "5087b7d6-9193-4e5b-b0ec-e5e8fd8b3c75";
    const leadRecord = await GeneralLeads.findOne({
      where: {
        //id: userId ,
        individual_segments: null,
        priority: 2
      }
    })

    const lead = leadRecord!!.get({ plain: true })

    //console.log(lead);

    const result = await aiClassifyLead(lead);

    //console.log("result")
    //console.log(result);
    leadRecord?.update(
      { individual_segments: result }
    )

    sendResponse(res, 200, "Leads classifiy", result);
    return;
  } catch (error: any) {
    logger.error(error, "Error");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
