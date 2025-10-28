import { Request, Response } from "express";
import Companies from "../../models/Companies";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

const sanitizeCompanyName = (original?: string | null): string | null => {
  if (!original) {
    return original ?? null;
  }

  const trimmed = original.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/[\\,\-]/);
  const sanitized = parts[0]?.trim() ?? "";
  return sanitized || trimmed;
};

export const sanitizeCompanyNames = async (_req: Request, res: Response) => {
  try {
    const companies = await Companies.findAll({
      attributes: ["id", "name"],
    });

    if (!companies.length) {
      sendResponse(res, 200, "No companies available to sanitize", {
        totalChecked: 0,
        updated: 0,
        skipped: 0,
      });
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const company of companies) {
      const currentName =
        typeof company.name === "string" ? company.name : null;
      const sanitized = sanitizeCompanyName(currentName);
      if (!sanitized || sanitized === company.name) {
        skipped += 1;
        continue;
      }

      await company.update({ name: sanitized });
      updated += 1;
    }

    sendResponse(res, 200, "Company names sanitized successfully", {
      totalChecked: companies.length,
      updated,
      skipped,
    });
  } catch (error: any) {
    logger.error(
      {
        error: error?.message,
        stack: error?.stack,
      },
      "Failed to sanitize company names"
    );
    sendResponse(res, 500, "Failed to sanitize company names", null, error?.message);
  }
};
