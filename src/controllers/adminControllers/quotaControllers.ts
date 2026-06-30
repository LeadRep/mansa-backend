import { Request, Response } from "express";
import logger from "../../logger";
import sendResponse from "../../utils/http/sendResponse";
import MonthlyQuotas from "../../models/MonthlyQuotas";
import Users from "../../models/Users";
import { Op, Sequelize } from "sequelize";

// Get all organizations with their quotas
export const getOrganizationQuotas = async (request: Request, response: Response) => {
  try {
    const { search = "", page = 1, limit = 20 } = request.query;
    const offset = (Number(page) - 1) * Number(limit);

    logger.info(`Fetching organization quotas: search="${search}", page=${page}, limit=${limit}`);

    // Build where clause for search on MonthlyQuotas
    const whereClause: any = {};

    // Get all quotas with pagination
    const { rows, count } = await MonthlyQuotas.findAndCountAll({
      where: whereClause,
      limit: Number(limit),
      offset: offset,
      order: [["updated_at", "DESC"]],
    });

    // Get organization/user details for each quota
    const organizationsMap = new Map();
    const orgIds = rows.map((q: any) => q.organization_id);

    if (orgIds.length > 0) {
      const users = await Users.findAll({
        where: {
          organization_id: { [Op.in]: orgIds },
        },
        attributes: ["id", "organization_id", "organization_name", "email"],
      });

      users.forEach((user: any) => {
        organizationsMap.set(user.organization_id, {
          organizationName: user.organization_name || "Unknown",
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

    logger.info(`Found ${filteredRows.length} organizations with quotas`);

    return sendResponse(response, 200, "Organizations fetched successfully", {
      organizations: filteredRows.map((quota: any) => {
        const orgInfo = organizationsMap.get(quota.organization_id) || {
          organizationName: "Unknown",
          email: "",
        };
        return {
          id: quota.id,
          organizationId: quota.organization_id,
          organizationName: orgInfo.organizationName,
          email: orgInfo.email,
          quotaLimit: quota.quota_limit,
          remaining: quota.remaining,
          used: quota.quota_limit - quota.remaining,
          usagePercentage: quota.quota_limit > 0 ? Math.round((quota.quota_limit - quota.remaining) / quota.quota_limit * 100) : 0,
          updatedAt: quota.updated_at,
        };
      }),
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

    const quota = await MonthlyQuotas.findOne({
      where: { organization_id: organizationId },
    });

    if (!quota) {
      return sendResponse(response, 404, "Quota not found for this organization");
    }

    // Get organization/user details
    const user = await Users.findOne({
      where: { organization_id: organizationId },
      attributes: ["id", "organization_id", "organization_name", "email", "subscription_tier"],
    });

    return sendResponse(response, 200, "Quota details fetched successfully", {
      id: quota.id,
      organizationId: quota.organization_id,
      organizationName: user?.organization_name || "Unknown",
      email: user?.email || "",
      subscriptionTier: user?.subscription_tier || "free",
      quotaLimit: quota.quota_limit,
      remaining: quota.remaining,
      used: quota.quota_limit - quota.remaining,
      usagePercentage: quota.quota_limit > 0 ? Math.round((quota.quota_limit - quota.remaining) / quota.quota_limit * 100) : 0,
      resetDate: quota.reset_date,
      createdAt: quota.created_at,
      updatedAt: quota.updated_at,
    });
  } catch (error: any) {
    logger.error(error, "Error fetching quota details");
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};

// Update organization quota
export const updateOrganizationQuota = async (request: Request, response: Response) => {
  try {
    const { organizationId } = request.params;
    const { quotaLimit, remaining } = request.body;

    // Validate input
    if (typeof quotaLimit !== "number" && typeof remaining !== "number") {
      return sendResponse(
        response,
        400,
        "Must provide either quotaLimit or remaining value"
      );
    }

    if (typeof quotaLimit === "number" && quotaLimit < 0) {
      return sendResponse(response, 400, "quotaLimit must be non-negative");
    }

    if (typeof remaining === "number" && remaining < 0) {
      return sendResponse(response, 400, "remaining must be non-negative");
    }

    logger.info(
      `Updating quota for org ${organizationId}: quotaLimit=${quotaLimit}, remaining=${remaining}`
    );

    const quota = await MonthlyQuotas.findOne({
      where: { organization_id: organizationId },
    });

    if (!quota) {
      return sendResponse(response, 404, "Quota not found for this organization");
    }

    // Update quota
    if (typeof quotaLimit === "number") {
      quota.quota_limit = quotaLimit;
    }

    if (typeof remaining === "number") {
      quota.remaining = remaining;
    }

    await quota.save();

    logger.info(
      `Quota updated for org ${organizationId}: new limit=${quota.quota_limit}, remaining=${quota.remaining}`
    );

    return sendResponse(response, 200, "Quota updated successfully", {
      id: quota.id,
      organizationId: quota.organization_id,
      quotaLimit: quota.quota_limit,
      remaining: quota.remaining,
      used: quota.quota_limit - quota.remaining,
      usagePercentage: quota.quota_limit > 0 ? Math.round((quota.quota_limit - quota.remaining) / quota.quota_limit * 100) : 0,
      updatedAt: quota.updated_at,
    });
  } catch (error: any) {
    logger.error(error, "Error updating quota");
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};

// Reset quota for an organization (set remaining to quota_limit)
export const resetOrganizationQuota = async (request: Request, response: Response) => {
  try {
    const { organizationId } = request.params;

    logger.info(`Resetting quota for org: ${organizationId}`);

    const quota = await MonthlyQuotas.findOne({
      where: { organization_id: organizationId },
    });

    if (!quota) {
      return sendResponse(response, 404, "Quota not found for this organization");
    }

    const previousRemaining = quota.remaining;
    quota.remaining = quota.quota_limit;
    quota.reset_date = new Date();

    await quota.save();

    logger.info(
      `Quota reset for org ${organizationId}: previous remaining=${previousRemaining}, new remaining=${quota.remaining}`
    );

    return sendResponse(response, 200, "Quota reset successfully", {
      id: quota.id,
      organizationId: quota.organization_id,
      quotaLimit: quota.quota_limit,
      remaining: quota.remaining,
      previousRemaining,
      resetDate: quota.reset_date,
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
        const { organizationId, quotaLimit, remaining } = update;

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

        if (typeof quotaLimit === "number") {
          quota.quota_limit = quotaLimit;
        }

        if (typeof remaining === "number") {
          quota.remaining = remaining;
        }

        await quota.save();
        results.success++;
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
