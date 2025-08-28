import { v4 } from "uuid";
import Deals from "../../../models/Deals";

export const createDeal = async (userId: string) => {
    try {
      const deal = await Deals.create({
        id: v4(),
        userId,
        stages: [
          { id: v4(), name: "New", color: "#FF5733" },
          { id: v4(), name: "Contacted", color: "#33FF57" },
          { id: v4(), name: "Qualified", color: "#3357FF" },
          { id: v4(), name: "Proposal Sent", color: "#F333FF" },
          { id: v4(), name: "Negotiation", color: "#33FFF5" },
          { id: v4(), name: "Closed Won", color: "#F5FF33" },
          { id: v4(), name: "Closed Lost", color: "#FF33A8" },
        ],
      });
      return true;
    } catch (error) {
      return false;
    }
  };