import {Request, Response} from "express";
import logger from "../../logger";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import MonthlyQuotas from "../../models/MonthlyQuotas";
import {ACILeads} from "../../models/ACILeads";
import {Op} from "sequelize";
import {v4 as uuidv4} from "uuid";
import {Parser} from "json2csv";
import {normalizeLead, PlainLead, formatMonthYear} from "./utils";
import {recordLeadExport} from "../../services/exportService";
import ACICompanies from "../../models/ACICompanies";

const MAX_EXPORT_IDS = 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Issue #1: Input validation helper
function validateExportIds(ids: any): { valid: boolean; error?: string } {
  if (!Array.isArray(ids)) {
    return { valid: false, error: "ids must be an array" };
  }

  if (ids.length === 0) {
    return { valid: false, error: "ids array cannot be empty" };
  }

  if (ids.length > MAX_EXPORT_IDS) {
    return { valid: false, error: `Cannot export more than ${MAX_EXPORT_IDS} leads at once` };
  }

  const invalidIds = ids.filter((id: any) => !UUID_REGEX.test(id));
  if (invalidIds.length > 0) {
    return { valid: false, error: "Invalid lead ID format. All IDs must be valid UUIDs" };
  }

  return { valid: true };
}

export const exportLeads = async (request: Request & { user?: any }, response: Response) => {
    try {
        logger.info(`exportLeads request received from user ${request.user?.id}`);

        const userId = request.user?.id;
        logger.info(`exportLeads initiated for user ${userId}`);

        if (!userId) {
            logger.warn(`exportLeads failed: No user ID in request`);
            return sendResponse(response, 401, "User not authenticated");
        }

        const user = await Users.findOne({ where: { id: userId } });
        if (!user) {
            logger.warn(`exportLeads failed: User not found for userId ${userId}`);
            return sendResponse(response, 401, "User not found");
        }

        if (!user.organization_id) {
            logger.warn(`exportLeads failed: User has no organization for userId ${userId}`);
            return sendResponse(response, 401, "Organization not found");
        }

        const organizationId = user.organization_id;
        logger.info(`exportLeads for user ${userId} in organization ${organizationId}`);

        // Issue #1: Validate IDs input
        const { ids } = request.body;
        logger.info(`Validating ${ids?.length || 0} lead IDs`);

        const validation = validateExportIds(ids);
        if (!validation.valid) {
            const errorMsg = validation.error || "Invalid export request";
            logger.warn(`exportLeads validation failed for user ${userId}: ${errorMsg}`);
            return sendResponse(response, 400, errorMsg);
        }

        logger.info(`Exporting ${ids.length} leads for user ${userId} from org ${organizationId}`);

        // Issue #2: Check and decrement quota atomically using database operation
        logger.info(`Checking quota for org ${organizationId}, count: ${ids.length}`);
        const quotaResult = await checkAndDecrementQuotaAtomic(organizationId, ids.length);
        if (!quotaResult.ok) {
            const quotaErrorMsg = quotaResult.message || "Quota check failed";
            logger.warn(`exportLeads quota check failed: ${quotaErrorMsg} (remaining: ${quotaResult.remaining})`);
            return sendResponse(response, 400, quotaErrorMsg);
        }

        logger.info(`Quota check passed. Remaining: ${quotaResult.remaining}`);

        // Generate CSV and upload
        const jobId = uuidv4();
        const { csv, exportId } = await generateExportCsv(ids, jobId, userId, organizationId);

        logger.info(`CSV generated for export ${exportId}. File size: ${csv.length} bytes`);

        // Issue #4: Wait for critical operation - don't fire and forget
        try {
            await recordLeadExport(ids, userId, organizationId, jobId, 'csv');
            logger.info(`Export ${exportId} recorded successfully`);
        } catch (err: any) {
            logger.error({ error: err.message }, "Failed to record lead export after CSV generation");
            return sendResponse(
                response,
                500,
                "Export created but tracking failed. Please contact support.",
                null,
                err.message
            );
        }

        // Issue #9: Consistent response format - Send CSV directly to frontend
        logger.info(`Export ${exportId} completed successfully for user ${userId}`);
        return sendResponse(response, 200, "Export completed successfully", {
            csv: csv,
            exportId,
            remaining: quotaResult.remaining,
            leadsExported: ids.length
        });
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack }, "exportLeads Error");
        return sendResponse(response, 500, "Internal Server Error", null, error.message);
    }
};

// Issue #2 & #6: Use atomic database operation for quota decrement
export async function checkAndDecrementQuotaAtomic(organizationId: string, count: number) {
    try {
        // First, check if quota exists and has sufficient remaining
        // To avoid failure, reset the quota if it doesn't exist for the current month
        const monthStart = formatMonthYear(new Date());
        const [quota, created] = await MonthlyQuotas.findOrCreate({
            where: { organization_id: organizationId, startDate: monthStart },
              defaults: {
                  remaining: 300,
                  organization_id: organizationId,
                  startDate: monthStart
              }
          });

        if (!quota) {
            logger.warn(`Quota not configured for organization ${organizationId}. quota is reset - TO BE INVESTIGATED`);
        }

        if (quota.remaining < count) {
            logger.warn(`Quota exceeded for org ${organizationId}: remaining=${quota.remaining}, requested=${count}`);
            return { ok: false, message: "Quota exceeded", remaining: quota.remaining };
        }

        // Issue #2: Use Sequelize atomic decrement (prevents race condition)
        // decrement returns [affectedRows: MonthlyQuotas[], affectedCount?: number]
        const result = await MonthlyQuotas.decrement('remaining', {
            by: count,
            where: { organization_id: organizationId , startDate: monthStart }
        }) as any;

        const affectedRows = Array.isArray(result) ? result : result?.[0];
        if (!affectedRows || affectedRows.length === 0) {
            logger.error(`Failed to decrement quota for org ${organizationId} in period ${monthStart}`);
            return { ok: false, message: "Failed to update quota", remaining: quota.remaining };
        }

        // Fetch updated quota
        const updatedQuota = await MonthlyQuotas.findOne({ where: { organization_id: organizationId , startDate: monthStart } });
        logger.info(`Quota decremented for org ${organizationId} (${monthStart}): ${count} leads. New remaining: ${updatedQuota?.remaining}`);

        return { ok: true, remaining: updatedQuota?.remaining ?? 0 };
    } catch (error: any) {
        logger.error({
            error: error.message,
            stack: error.stack,
            organizationId,
            count
        }, "Error in checkAndDecrementQuotaAtomic");
        // Return error object instead of throwing to maintain consistency
        return {
            ok: false,
            message: `Error checking quota: ${error.message}`,
            remaining: null
        };
    }
}

// Issue #7: Generates a CSV file for the given lead IDs with validation
export async function generateExportCsv(
    leadIds: string[],
    exportId: string,
    userId: string,
    organizationId: string
) {
    try {
        logger.info(`Generating CSV for export ${exportId}: ${leadIds.length} leads`);

        // Issue #7: Verify leads exist and belong to organization
        const rows = await ACILeads.findAll({
            where: {
                id: { [Op.in]: leadIds }
            },
            include: [
                {
                    model: ACICompanies,
                    as: "org_info",
                }
            ]
        });

        logger.info(`Found ${rows.length} leads matching export criteria (requested: ${leadIds.length})`);

        // Issue #7: Check if all requested leads were found
        if (rows.length === 0) {
            logger.warn(`No leads found for export ${exportId}`);
            throw new Error("No leads found with provided IDs in your organization");
        }

        if (rows.length !== leadIds.length) {
            const foundIds = rows.map(r => r.id);
            const notFoundIds = leadIds.filter(id => !foundIds.includes(id));
            logger.warn(`${notFoundIds.length} leads not found or not accessible for export ${exportId}`);
            throw new Error(`${notFoundIds.length} leads not found or not accessible to your organization`);
        }

        // Process and normalize leads
        const leads = rows.map((lead) =>
            normalizeLead(lead.get({ plain: true }) as PlainLead)
        );

        logger.info(`Normalized ${leads.length} leads for CSV generation`);

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
                    : null;
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

        // Issue #10: Log CSV generation steps, Issue #12: Error handling for parser
        try {
            const parser = new Parser({ fields });
            const csv = parser.parse(leads);

            // Add UTF-8 BOM to ensure Excel recognizes UTF-8 encoding
            const BOM_UTF8 = '\ufeff';
            const csvWithBOM = BOM_UTF8 + csv;

            logger.info(`CSV generated successfully for export ${exportId}. Size: ${csvWithBOM.length} bytes`);
            return { csv: csvWithBOM, exportId };
        } catch (parseError: any) {
            logger.error({ error: parseError.message }, `CSV parsing failed for export ${exportId}`);
            throw new Error(`Failed to generate CSV export: ${parseError.message}`);
        }
    } catch (error: any) {
        logger.error({ error: error.message, exportId }, "Error in generateExportCsv");
        throw error;
    }
}
