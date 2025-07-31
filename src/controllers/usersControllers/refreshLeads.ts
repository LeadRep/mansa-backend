import { Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../utils/http/sendResponse";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import Users from "../../models/Users";
import { findLeads } from "../aiControllers/findLeads";
import { Leads, LeadStatus } from "../../models/Leads";

export const refreshLeads = async (request: JwtPayload, response: Response) => {
  const userId = request.user.id;
  console.log("Starting refresh leads...")
  try {
    const customer = await CustomerPref.findOne({ where: { userId } });
    const user = await Users.findByPk(userId);
    if (!user?.subscriptionName) {
      sendResponse(
        response,
        400,
        "You need to have a subscription to refresh leads"
      );
      return;
    }
    if (customer?.refreshLeads < 1) {
      sendResponse(
        response,
        400,
        "You have used up your number of refresh for today"
      );
      return;
    }
    if (
      customer?.refreshLeads > 1 &&
      customer?.nextRefresh &&
      new Date(customer.nextRefresh) > new Date()
    ) {
      const formattedDate = new Date(customer.nextRefresh).toLocaleString(
        "en-US",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true, // Use 12-hour format with AM/PM
          timeZoneName: "short",
        }
      );
      sendResponse(
        response,
        400,
        `Your next refresh available at ${formattedDate}`
      );
      return;
    }
    // Decrement the refreshLeads count & Update the next refresh time to 1 hour later
    console.log("Updating customer pref...");
    await CustomerPref.update(
      {
        refreshLeads: customer?.refreshLeads - 1,
        nextRefresh: new Date(Date.now() + 3600000), // 1 hour later
        leadsGenerationStatus: LeadsGenerationStatus.ONGOING,
      },
      { where: { userId } }
    );
    // Remove all current leads with status new
    console.log("Deleting all existing leads");
    await Leads.destroy({
      where: { owner_id: userId, status: LeadStatus.NEW },
    });
    sendResponse(response, 200, "Leads refresh in progress");
    await findLeads(userId, 24);
    return;
  } catch (error: any) {
    console.log("Error in refreshLeads controller:", error.message);
    sendResponse(response, 500, "Internal Server Error", null, error.message);
    return;
  }
};
