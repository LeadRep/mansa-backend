import dotenv from "dotenv";
import Users from "../../models/Users";
import {Op} from "sequelize";
import logger from "../../logger";
import {CustomerPref} from "../../models/CustomerPref";
import {subscriptionNameToRefreshLeads} from "./subscriptionNameToRefreshLeads";

dotenv.config();

export const customerPreferenceAllowanceRefresh = async () => {
  logger.info("Running customerPreferenceAllowanceRefresh...");
  try {
    const duePrefs = await CustomerPref.findAll({
      where: {
        nextRefresh: {
          [Op.lte]: new Date(),
        },
      },
      include: [
        {
          model: Users,
          as: "user",
          attributes: ["id", "subscriptionName"],
        },
      ],
    });

    if (!duePrefs.length) {
      logger.info("No customer prefs to refresh.");
      return;
    }

    for (const pref of duePrefs) {
      try {
        const user = pref.user;
        const userId = pref.userId;

        let allowance: number = 5; // Default allowance
        if (user) {
          const subscriptionName = user.subscriptionName;
          if (subscriptionName && subscriptionNameToRefreshLeads[subscriptionName]) {
            allowance = subscriptionNameToRefreshLeads[subscriptionName];
          } else {
            logger.warn(
              { userId, subscriptionName },
              "Unknown or missing subscriptionName, using default allowance"
            );
          }
        } else {
          logger.warn({ prefId: pref.id }, "CustomerPref missing user, using default allowance");
        }

        const nextRefresh = new Date();
        nextRefresh.setMonth(nextRefresh.getMonth() + 1);
        nextRefresh.setHours(0, 0, 0, 0);

        await pref.update({
          refreshLeads: allowance,
          nextRefresh,
        });
        logger.info({ prefId: pref.id, allowance }, "Refreshed customer pref");
      } catch (innerErr) {
        logger.error(innerErr, "Failed to refresh a customer pref");
      }
    }
  } catch (err) {
    logger.error(err, "Error running customerPreferenceAllowanceRefresh");
  }
};
