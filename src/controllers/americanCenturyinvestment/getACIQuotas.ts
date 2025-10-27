import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";
import MonthlyQuotas from "../../models/MonthlyQuotas";

function getMonthStart(): Date /* YYYY-MM-DD */ {
    // JS doesn't shift zones natively without Intl; we can rely on server time + tz offset via Intl API:
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export const getACIQuotas = async (request: Request, response: Response) => {
    try {
        logger.info("Get ACI Quotas");
        const userId = request.user?.id;
        const user = await Users.findOne({ where: { id: userId } });
        if(!user) {
            sendResponse(response, 401, "User not found");
            return;
        }
        const monthStart = getMonthStart();
        const quota = await MonthlyQuotas.findOne(
            { where: { organization_id: user.organization_id , startDate: monthStart} }
        )
        if (quota) {
            sendResponse(response, 200, "get quotas for this month", quota);
            return;
        }
        const q = await MonthlyQuotas.create(
            {
                organization_id: user.organization_id,
                startDate: monthStart,
                remaining: 300
            }
        )
        sendResponse(response, 200, "No quotas found for this month", q);
        return;

    } catch (error: any) {
        logger.error(error, "Get ACI Quotas Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};