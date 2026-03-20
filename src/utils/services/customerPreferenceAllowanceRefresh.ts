import dotenv from "dotenv";
import {Op, QueryTypes} from "sequelize";
import logger from "../../logger";
import {subscriptionNameToRefreshLeads} from "./subscriptionNameToRefreshLeads";
import Organizations from "../../models/Organizations";
import {database} from "../../configs/database/database";

dotenv.config();

export const customerPreferenceAllowanceRefresh = async () => {
  logger.info("Running customerPreferenceAllowanceRefresh...");
  try {
    const dueOrgs = await Organizations.findAll({
      where: {
        nextRefresh: {
          [Op.lte]: new Date(),
        }
      }
    });

    if (!dueOrgs.length) {
      logger.info("No org prefs to refresh.");
      return;
    }

    for (const org of dueOrgs) {
      try {

        let allowance: number = 100; // Default allowance
        const subscriptionName = org.plan;
        if (subscriptionName && subscriptionNameToRefreshLeads[subscriptionName]) {
          allowance = subscriptionNameToRefreshLeads[subscriptionName];
        } else {
          logger.warn(
            { orgId: org.organization_id, subscriptionName },
            "Unknown or missing subscriptionName, using default allowance"
          );
        }


        const nextRefresh = new Date();
        nextRefresh.setMonth(nextRefresh.getMonth() + 1);
        nextRefresh.setHours(0, 0, 0, 0);



        await database.query(
          `UPDATE "CustomerPrefs"
            SET "refreshLeads" = :allowance
            WHERE "userId" IN (
                SELECT id FROM "Users" WHERE organization_id = :orgId
            )`,
          {
            replacements: { allowance, orgId: (org as any).organization_id },
            type: QueryTypes.UPDATE,
          }
        );
        logger.info({ prefId: org.id, allowance }, "Refreshed customer pref");
        await org.update({
          //refreshLeads: allowance,
          nextRefresh: nextRefresh,
        });
      } catch (innerErr) {
        logger.error(innerErr, "Failed to refresh a customer pref");
      }
    }
  } catch (err) {
    logger.error(err, "Error running customerPreferenceAllowanceRefresh");
  }
};
