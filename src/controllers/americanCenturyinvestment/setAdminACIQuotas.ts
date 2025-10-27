import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";
import MonthlyQuotas from "../../models/MonthlyQuotas";


export const setAdminACIQuotas = async (request: Request, response: Response) => {
    try {
        logger.info("set Admin ACI Quotas");

        let { remaining } = request.body;

        let val = remaining;
        if (!remaining) {
            val = 300;
        }

        //create or update
        MonthlyQuotas.update({ remaining: val }, { where: {} });
        sendResponse(response, 201, "Quota created for this month");

        return;

    } catch (error: any) {
        logger.error(error, "set Admin ACI Quotas Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};