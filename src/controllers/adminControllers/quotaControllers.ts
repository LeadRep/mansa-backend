import { Request, Response } from "express";
import logger from "../../logger";
import sendResponse from "../../utils/http/sendResponse";
import MonthlyQuotas from "../../models/MonthlyQuotas";
import Users from "../../models/Users";
import { Op, Sequelize } from "sequelize";
import { formatMonthYear } from "../aciControllers/utils";
import Organizations from "../../models/Organizations";

// Get all organizations with their quotas
export const getOrganizationQuotas = async (request: Request, response: Response) => {
  try {
    const { search = "", page = 1, limit = 20, month = "", year = "" } = request.query;
    const offset = (Number(page) - 1) * Number(limit);

    logger.info(
      `Fetching organization quotas: search="${search}", month="${month}", year="${year}", page=${page}, limit=${limit}`
    );

    // Build where clause for search on MonthlyQuotas
    const monthStart = formatMonthYear(new Date());
    const whereClause: any = {startDate: monthStart};

    // Get all quotas with pagination
    const { rows, count } = await MonthlyQuotas.findAndCountAll({
      where: whereClause,
      limit: Number(limit),
      offset: offset,
      order: [["updatedAt", "DESC"]],
    });

    // Get organization/user details for each quota
    const organizationsMap = new Map();
    const orgIds = rows.map((q: any) => q.organization_id);

    if (orgIds.length > 0) {
      const orgs = await Organizations.findAll({
        where: {
          organization_id: { [Op.in]: orgIds },
        },
        attributes: ["organization_id", "name"],
      });

      const users = await Users.findAll({
        where: {
          organization_id: { [Op.in]: orgIds },
        },
        attributes: ["id", "organization_id", "companyName", "email"],
      });

      // Create map from organizations
      const orgMap = new Map();
      orgs.forEach((org: any) => {
        orgMap.set(org.organization_id, org.name || "Unknown");
      });

      // Use organization name from Organizations table, fallback to companyName from Users
      users.forEach((user: any) => {
        organizationsMap.set(user.organization_id, {
          organizationName: orgMap.get(user.organization_id) || user.companyName || "Unknown",
          email: user.email || "",
        });
      });
    }

    // Apply search filter to results
    let filteredRows = rows;
    if (search && typeof search === "string" && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredRows = rows.filter((quota: any) => {
        const orgName = organizationsMap.get(quota.organization_id)?.organizationName || "";
        return orgName.toLowerCase().includes(searchLower);
      });
    }

    const totalPages = Math.ceil(filteredRows.length / Number(limit));

    // Get available months for filtering
    const availableMonths = await MonthlyQuotas.findAll({
      attributes: ["startDate"],
      group: ["startDate"],
      raw: true,
      order: [["startDate", "DESC"]],
    });

    const uniqueMonths = availableMonths
      .map((q: any) => q.startDate)
      .filter((date: string) => date && typeof date === "string")
      .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);

    logger.info(`Found ${filteredRows.length} organizations with quotas. Available months: ${uniqueMonths.length}`);

    return sendResponse(response, 200, "Organizations fetched successfully", {
      organizations: filteredRows.map((quota: any) => {
        const orgInfo = organizationsMap.get(quota.organization_id) || {
          organizationName: "Unknown",
          email: "",
        };
        return {
          organizationId: quota.organization_id,
          organizationName: orgInfo.organizationName,
          email: orgInfo.email,
          remaining: quota.remaining,
          startDate: quota.startDate,
          updatedAt: quota.updatedAt,
        };
      }),
      availableMonths: uniqueMonths,
      currentFilter: {
        month: month || "",
        year: year || "",
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredRows.length,
        pages: totalPages,
      },
    });
  } catch (error: any) {
    logger.error(error, "Error fetching organization quotas");
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};

// Get quota details for a specific organization
export const getOrganizationQuotaDetails = async (request: Request, response: Response) => {
  try {
    const { organizationId } = request.params;

    logger.info(`Fetching quota details for org: ${organizationId}`);
    const monthStart = formatMonthYear(new Date());
    const quota = await MonthlyQuotas.findOne({
      where: { organization_id: organizationId, startDate: monthStart },
    });

    if (!quota) {
      return sendResponse(response, 404, "Quota not found for this organization");
    }

    // Get organization and user details
    const org = await Organizations.findOne({
      where: { organization_id: organizationId },
      attributes: ["organization_id", "name"],
    });

    const user = await Users.findOne({
      where: { organization_id: organizationId },
      attributes: ["id", "organization_id", "companyName", "email"],
    });

    const organizationName = org?.name || user?.companyName || "Unknown";

    return sendResponse(response, 200, "Quota details fetched successfully", {
      id: quota.id,
      organizationId: quota.organization_id,
      organizationName: organizationName,
      email: user?.email || "",
      remaining: quota.remaining,
      startDate: quota.startDate,
      createdAt: quota.createdAt,
      updatedAt: quota.updatedAt,
    });
  } catch (error: any) {
    logger.error(error, "Error fetching quota details");
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};

// Update organization quota remaining
export const updateOrganizationQuota = async (request: Request, response: Response) => {
  try {
    const { organizationId } = request.params;
    const { remaining } = request.body;

    // Validate input
    if (typeof remaining !== "number") {
      return sendResponse(response, 400, "Must provide remaining value");
    }

    if (remaining < 0) {
      return sendResponse(response, 400, "remaining must be non-negative");
    }

    logger.info(`Updating quota for org ${organizationId}: remaining=${remaining}`);
    const monthStart = formatMonthYear(new Date());
    const quota = await MonthlyQuotas.findOne({
      where: { organization_id: organizationId, startDate: monthStart },
    });

    if (!quota) {
      return sendResponse(response, 404, "Quota not found for this organization");
    }

    quota.remaining = remaining;
    await quota.save();

    logger.info(`Quota updated for org ${organizationId}: new remaining=${quota.remaining}`);

    return sendResponse(response, 200, "Quota updated successfully", {
      id: quota.id,
      organizationId: quota.organization_id,
      remaining: quota.remaining,
      startDate: quota.startDate,
      updatedAt: quota.updatedAt,
    });
  } catch (error: any) {
    logger.error(error, "Error updating quota");
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};

// Reset quota for an organization (set remaining to high value)
export const resetOrganizationQuota = async (request: Request, response: Response) => {
  try {
    const { organizationId } = request.params;
    const { remaining = 10000 } = request.body; // Default reset value

    logger.info(`Resetting quota for org: ${organizationId}`);
    const monthStart = formatMonthYear(new Date());
    const quota = await MonthlyQuotas.findOne({
      where: { organization_id: organizationId, startDate: monthStart },
    });

    if (!quota) {
      return sendResponse(response, 404, "Quota not found for this organization");
    }

    const previousRemaining = quota.remaining;
    quota.remaining = remaining;

    await quota.save();

    logger.info(
      `Quota reset for org ${organizationId}: previous remaining=${previousRemaining}, new remaining=${quota.remaining}`
    );

    return sendResponse(response, 200, "Quota reset successfully", {
      id: quota.id,
      organizationId: quota.organization_id,
      remaining: quota.remaining,
      previousRemaining,
      updatedAt: quota.updatedAt,
    });
  } catch (error: any) {
    logger.error(error, "Error resetting quota");
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};

// Bulk update quotas for multiple organizations
export const bulkUpdateQuotas = async (request: Request, response: Response) => {
  try {
    const { updates } = request.body;

    if (!Array.isArray(updates)) {
      return sendResponse(response, 400, "updates must be an array");
    }

    logger.info(`Bulk updating ${updates.length} organization quotas`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const update of updates) {
      try {
        const { organizationId, remaining } = update;

        if (!organizationId) {
          results.errors.push({
            organizationId,
            error: "organizationId is required",
          });
          results.failed++;
          continue;
        }

        const quota = await MonthlyQuotas.findOne({
          where: { organization_id: organizationId },
        });

        if (!quota) {
          results.errors.push({
            organizationId,
            error: "Quota not found",
          });
          results.failed++;
          continue;
        }

        if (typeof remaining === "number") {
          quota.remaining = remaining;
          await quota.save();
          results.success++;
        } else {
          results.errors.push({
            organizationId,
            error: "remaining value must be a number",
          });
          results.failed++;
        }
      } catch (err: any) {
        results.errors.push({
          organizationId: update.organizationId,
          error: err.message,
        });
        results.failed++;
      }
    }

    logger.info(`Bulk quota update completed: ${results.success} success, ${results.failed} failed`);

    return sendResponse(response, 200, "Bulk quota update completed", results);
  } catch (error: any) {
    logger.error(error, "Error in bulk quota update");
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
