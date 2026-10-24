import { step2LeadGen } from "./step2LeadGen";
import { leadGenV2 } from "../leadGenV2";
import logger from "../../logger";
import Users from "../../models/Users";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import { getLeadGenLogger, withLeadGenContext } from "../../utils/leadGenLogger";

export const runLeadGeneration = async (
  userId: string,
  totalLeads: number,
  restart?: boolean,
  expand?: boolean,
  trigger: string = "unknown",
) => {
  const model = String(process.env.LEADGEN_MODEL || "")
    .trim()
    .toLowerCase();
  const version = model === "v2" ? "v2" : "v1";

  return withLeadGenContext(
    userId,
    { version, trigger, restart: Boolean(restart), expand: Boolean(expand) },
    async () => {
      const log = getLeadGenLogger();
      try {
        const customer = await CustomerPref.findOne({ where: { userId } });
        if (customer?.leadsGenerationStatus === LeadsGenerationStatus.ONGOING) {
          log.info(
            { totalLeads, restart: Boolean(restart), expand: Boolean(expand) },
            "Lead generation already in progress for this user, skipping new generation request",
          );
          return null;
        }

        log.info(
          { totalLeads, restart: Boolean(restart), expand: Boolean(expand) },
          `Lead generation requested, running leadGen ${version}`,
        );
        const startedAt = Date.now();
        const result =
          version === "v2"
            ? await leadGenV2(userId, totalLeads, restart, expand)
            : await step2LeadGen(userId, totalLeads, restart);
        log.info(
          { durationMs: Date.now() - startedAt, success: result !== null },
          "Lead generation run finished",
        );
        return result;
      } catch (error) {
        log.error(error, "Error running lead generation");
        throw error;
      }
    },
  );
};
