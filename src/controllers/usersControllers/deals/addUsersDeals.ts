import Deals from "../../../models/Deals";
import Users from "../../../models/Users";
import { createDeal } from "./createDeal";
import logger from "../../../logger";

export const addUsersDeals = async () => {
  logger.info("Starting to add deals to all users...");
  try {
    const allUsers = await Users.findAll({});
    for (const user of allUsers) {
      const dealExists = await Deals.findOne({ where: { userId: user.id } });
      if (dealExists) {
        logger.info(`Deal already exists for user ${user.id}, skipping...`);
        continue;
      }else{
      await createDeal(user.id);
      }
    }
    logger.info("Deals added to all users successfully");
  } catch (error: any) {
    logger.error(error, "Error adding deals to users:");
  }
};
