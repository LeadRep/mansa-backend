import Users from "../../models/Users";
import { findLeads } from "../../controllers/aiControllers/findLeads";
import { Request, Response } from "express";
import sendResponse from "../http/sendResponse";
import { Leads } from "../../models/Leads";

export const refreshLeads = async (request: Request, response: Response) => {
  try {
    const allUsers = await Users.findAll({})
    const userIds = allUsers.map((user) => user.id);
    const leads = await Promise.all(userIds.map((id) => findLeads(id, 100)));
  } catch (error: any) {
    console.error("Error while refreshing leads:", error.message);
    sendResponse(response, 500, "Error while refreshing leads");
  }
};
