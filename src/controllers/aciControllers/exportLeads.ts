import {Request, Response} from "express";
import logger from "../../logger";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import MonthlyQuotas from "../../models/MonthlyQuotas";
import {GeneralLeads} from "../../models/GeneralLeads";
import {Op} from "sequelize";
import {v4 as uuidv4} from "uuid";
import {Parser} from "json2csv";
import {normalizeLead, PlainLead} from "./utils";


export const exportLeads = async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;
        logger.info(`exportLeads for user ${userId}}`);
        const user = await Users.findOne({ where: { id: userId } });
        if(!user) {
            sendResponse(response, 401, "User not found");
            return;
        }
        const { ids } = request.body;

        // 1. Check and decrement quota atomically
        const quotaResult = await checkAndDecrementQuota(user.organization_id, ids.length);
        if (!quotaResult.ok) {
            return response.status(400).json({ message: quotaResult.message, remaining: quotaResult.remaining });
        }

        // 2. Generate CSV and upload (or serve)
        const { csv, exportId } = await generateExportCsv(ids);

        // 3. Return download URL and updated quota
        response.json({
            data: {
                csv: csv,
                exportId,
                remaining: quotaResult.remaining
            }
        });
    } catch (error: any) {
        logger.error(error, "exportLeads Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};

// Checks and decrements the user's monthly quota atomically
export async function checkAndDecrementQuota(organizationId: string, count: number) {
    const quota = await MonthlyQuotas.findOne({ where: { organization_id: organizationId } });
    if (!quota || quota.remaining < count) {
        return { ok: false, message: "Quota exceeded", remaining: quota?.remaining ?? 0 };
    }
    quota.remaining -= count;
    await quota.save();
    return { ok: true, remaining: quota.remaining };
}

// Generates a CSV file for the given lead IDs and returns a download URL and export ID
export async function generateExportCsv(leadIds: number[]) {
    const rows = await GeneralLeads.findAll({ where: { id: { [Op.in]: leadIds } } });
    const leads = rows.map((lead) =>
        normalizeLead(lead.get({ plain: true }) as PlainLead)
    );
    const exportId = uuidv4();
    const fields = [
        {"label": "ID", "value": "id"},
        {"label": "Name", "value": "name"},
        {"label": "Title", "value": "title"},
        {"label": "Company", "value": "company"},
        {"label": "Country", "value": "country"},
        {"label": "Email", "value": "email"},
        {"label": "Phone", "value": "phone"},
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(leads);
    return { csv, exportId };
}
