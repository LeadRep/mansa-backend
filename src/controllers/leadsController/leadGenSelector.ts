import { step2LeadGen } from "./step2LeadGen";
import { leadGenV2 } from "../leadGenV2";
import logger from "../../logger";
import Users from "../../models/Users";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";

export const runLeadGeneration = async (
  userId: string,
  totalLeads: number,
  restart?: boolean,
  expand?: boolean,
) => {
  try {
    const customer = await CustomerPref.findOne({ where: { userId } });
    if (customer?.leadsGenerationStatus === LeadsGenerationStatus.ONGOING) {
      logger.info(
        { userId },
        "Lead generation already in progress for this user, skipping new generation request",
      );
      return null;
    }

    const model = String(process.env.LEADGEN_MODEL || "")
      .trim()
      .toLowerCase();

    if (model === "v2") {
      logger.info("Running lead generation using leadGenV2");
      return leadGenV2(userId, totalLeads, restart, expand);
    }

    logger.info("Running lead generation using leadGenV1");
    return step2LeadGen(userId, totalLeads, restart);
  } catch (error) {
    logger.error(error, "Error running lead generation");
    throw error;
  }
}; 
