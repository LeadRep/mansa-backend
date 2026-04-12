import {Request, Response} from "express";
import logger from "../../logger";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import MonthlyQuotas from "../../models/MonthlyQuotas";
import {ACILeads} from "../../models/ACILeads";
import {Op} from "sequelize";
import {v4 as uuidv4} from "uuid";
import {Parser} from "json2csv";
import {normalizeLead, PlainLead} from "./utils";
import {recordLeadExport} from "../../services/exportService";
import ACICompanies from "../../models/ACICompanies";


export const exportLeads = async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;
        logger.info(`exportLeads for user ${userId}}`);
        const user = await Users.findOne({ where: { id: userId } });
        if(!user) {
            sendResponse(response, 401, "User not found");
            return;
        }
        logger.info(`exportLeads for user ${userId} at organization ${user.organization_id}}`);
        const { ids } = request.body;

        // 1. Check and decrement quota atomically
        const quotaResult = await checkAndDecrementQuota(user.organization_id, ids.length);
        if (!quotaResult.ok) {
            return response.status(400).json({ message: quotaResult.message, remaining: quotaResult.remaining });
        }

        // 2. Generate CSV and upload (or serve)
        const jobId = uuidv4();
        const { csv, exportId } = await generateExportCsv(ids, jobId);

        // 4. Update asynchronously viewed record
        recordLeadExport(ids, userId, user.organization_id, jobId, 'csv').catch((err) => {
            logger.error(err, "Failed to record lead export");
        });

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

// Generates a CSV file for the given lead IDs and returns it along with the provided export ID
export async function generateExportCsv(leadIds: string[], exportId: string) {
    const rows = await ACILeads.findAll({
      where: { id: { [Op.in]: leadIds } },
      include: [
        {
          model: ACICompanies,
          as: "org_info",
        }
      ]
    });
    const leads = rows.map((lead) =>
        normalizeLead(lead.get({ plain: true }) as PlainLead)
    );

    const fields = [
        {"label": "ID", "value": "id"},
        {"label": "firstName", "value": "firstName"},
        {"label": "lastName", "value": "lastName"},
        {"label": "Title", "value": "title"},
        {"label": "Email", "value": "email"},
        {"label": "Phone", "value": "phone"},
        {"label": "City", "value": "leadCity"},
        {"label": "Country", "value": "leadCountry"},
        {"label": "Firm", "value": "company"},
        {"label": "Firm raw address", "value": "organization.raw_address"},
        {"label": "Firm street address", "value": "organization.street_address"},
        {"label": "Firm city", "value": "organization.city"},
        {"label": "Firm state", "value": "organization.state"},
        {"label": "Firm postal code", "value": "organization.postal_code"},
        {"label": "Firm country", "value": "organization.country"},
        {"label": "Firm industry", "value": "organization.industry"},
        {"label": "Firm size", "value": "companySize"},
        {"label": "Firm segment", "value": "companySegment"},
        {"label": "AUM", "value": (row: any) => {
            const aum = row.aumJson;
            const value = aum?.value || '';
            const currency = aum?.currency || '';

            if (!value && !currency) return '';
            if (!currency) return value;
            if (!value) return currency;

            return `${value} ${currency}`;
          }},
      {"label": "Lead specialty(AI)", "value": (row: any) => {

          const segs = Array.isArray(row.individualSegments)
            ? row.individualSegments
            : Array.isArray(row.individualSegments?.asset_allocation_focus)
              ? row.individualSegments.asset_allocation_focus
              : null;

          const displayText = segs
            ? segs.length > 0
              ? segs.join(", ")
              : "None identified"
            :null
          return displayText;
      }},
      {"label": "Lead specialty(AI) notes", "value": (row: any) => {
          const notes =
            typeof row.individualSegments === "object" && row.individualSegments
              ? (row.individualSegments.notes as string | undefined)
              : null;
          return notes;
        }},
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(leads);
    // Add UTF-8 BOM to ensure Excel recognizes UTF-8 encoding
    const csvWithBOM = '\ufeff' + csv;

    return { csv: csvWithBOM, exportId };
}
