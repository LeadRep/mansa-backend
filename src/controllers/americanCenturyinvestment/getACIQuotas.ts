import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";
import MonthlyQuotas from "../../models/MonthlyQuotas";


const formatMonthYear = (date: Date) =>
    date.toLocaleString("default", { month: "short", year: "numeric" });


export const getACIQuotas = async (request: Request, response: Response) => {
    try {
        logger.info("Get ACI Quotas");
        const userId = request.user?.id;
        const user = await Users.findOne({ where: { id: userId } });
        if(!user) {
            sendResponse(response, 401, "User not found");
            return;
        }
        const monthStart = formatMonthYear(new Date());
        const [quota, created] = await MonthlyQuotas.findOrCreate({
            where: { organization_id: user.organization_id, startDate: monthStart },
            defaults: {
                remaining: 300,
                organization_id: user.organization_id,
                startDate: monthStart
            }
        });
        if (created) {
            logger.info("quota created", quota.remaining);
            sendResponse(response, 200, "No quotas found for this month", quota);
        } else {
            logger.info("quota found", quota.remaining);
            sendResponse(response, 200, "get quotas for this month", quota);
        }
        return;

    } catch (error: any) {
        logger.error(error, "Get ACI Quotas Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};