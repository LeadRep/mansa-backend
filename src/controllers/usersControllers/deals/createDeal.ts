import { v4 } from "uuid";
import { Transaction } from "sequelize";
import Deals from "../../../models/Deals";
import { applyStageProbabilities } from "../../../utils/deals/stageProbabilities";

export const createDeal = async (userId: string, transaction?: Transaction) => {
    try {
      const deal = await Deals.create({
        id: v4(),
        userId,
        stages: applyStageProbabilities([
          { id: v4(), name: "New", color: "#FF5733" },
          { id: v4(), name: "Contacted", color: "#33FF57" },
          { id: v4(), name: "Qualified", color: "#3357FF" },
          { id: v4(), name: "Proposal Sent", color: "#F333FF" },
          { id: v4(), name: "Negotiation", color: "#33FFF5" },
          { id: v4(), name: "Closed Won", color: "#F5FF33" },
          { id: v4(), name: "Closed Lost", color: "#FF33A8" },
        ]),
      }, { transaction });
      return true;
    } catch (error) {
      return false;
    }
  };
