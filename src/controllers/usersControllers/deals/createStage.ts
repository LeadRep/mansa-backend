import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../../utils/http/sendResponse";
import { v4 } from "uuid";
import Deals from "../../../models/Deals";

export const createStage = async (request: JwtPayload, response: Response) => {
  try {
    const userId = request.user.id;
    const { dealId } = request.params;
    const { name, color } = request.body;

    if (!name) {
      sendResponse(response, 400, "Stage name is required");
      return;
    }

    const deal = await Deals.findOne({ where: { userId, id: dealId } });
    const newStage = {
      id: v4(),
      name,
      color: color || "#FFFFFF",
    };
    const stages = deal?.stages;
    stages.push(newStage);
    await deal?.update({ stages: stages });

    sendResponse(response, 200, "Stage created successfully", newStage);
  } catch (error: any) {
    console.log("Error creating stage:", error.message);
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
