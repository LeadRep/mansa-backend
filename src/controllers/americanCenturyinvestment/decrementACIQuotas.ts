import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import Users from "../../models/Users";
import MonthlyQuotas from "../../models/MonthlyQuotas";

const formatMonthYear = (date: Date) =>
    date.toLocaleString("default", { month: "short", year: "numeric" });


export const decrementACIQuotas = async (request: Request, response: Response) => {
    try {
        logger.info("decrementACIQuotas");
        const userId = request.user?.id;
        const user = await Users.findOne({ where: { id: userId } });
        if(!user) {
            sendResponse(response, 401, "User not found");
            return;
        }
        const { decrement } = request.body;

        if (!decrement) {
            sendResponse(response, 400, "Bad Request: decrement field is required");
            return;
        }
        const monthStart = formatMonthYear(new Date());

        //create or update
        let quota = await MonthlyQuotas.findOne({
            where: { organization_id: user.organization_id, startDate: monthStart }
        });
        if (!quota) {
            sendResponse(response, 404, "limit exceeded for this month", { ok: false, remaining: 0, message: "Update" } );
            return;
        }
        const remaining = quota.remaining - decrement;

        if (remaining < 0) {
            sendResponse(response, 400, "Insufficient remaining quota", { ok: false, remaining: quota.remaining, message: "Update" });
            return;
        }
        await quota.update({ remaining: remaining });
        sendResponse(response, 200, "Quota updated for this month", { ok: true, remaining: quota.remaining, message: "Update" });
        return;

    } catch (error: any) {
        logger.error(error, "set ACI Quotas Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};