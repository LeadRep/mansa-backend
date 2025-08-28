import Deals from "../../../models/Deals";
import Users from "../../../models/Users";
import { createDeal } from "./createDeal";

export const addUsersDeals = async () => {
  console.log("Starting to add deals to all users...");
  try {
    const allUsers = await Users.findAll({});
    for (const user of allUsers) {
      const dealExists = await Deals.findOne({ where: { userId: user.id } });
      if (dealExists) {
        console.log(`Deal already exists for user ${user.id}, skipping...`);
        continue;
      }else{
      await createDeal(user.id);
      }
    }
    console.log("Deals added to all users successfully");
  } catch (error: any) {
    console.log("Error adding deals to users:", error.message);
  }
};
