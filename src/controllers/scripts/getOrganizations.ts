import axios from "axios";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import Companies, { CompaniesAttributes } from "../../models/Companies";
import sendResponse from "../../utils/http/sendResponse";
import { Request, Response } from "express";
import logger from "../../logger";

type CsvRecord = Record<string, string>;

const CSV_FILE_PATH = path.resolve(
  __dirname,
  "../../../exports/scr/organizationsFile.csv"
);

const APOLLO_ORG_URL = "https://api.apollo.io/v1/mixed_companies/search";

const APOLLO_ORG_CONCURRENCY = (() => {
  const raw = process.env.APOLLO_ORG_CONCURRENCY ?? "5";
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 5 : parsed;
})();

const buildApolloHeaders = () => ({
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
  accept: "application/json",
  "x-api-key": process.env.APOLLO_API_KEY!,
});

const sanitize = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower === "n/a" ||
    lower === "na" ||
    lower === "null" ||
    lower === "none" ||
    lower.startsWith("n/a")
  ) {
    return null;
  }

  return trimmed;
};

const normalizeName = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase().replace(/\s+/g, " ");
};

const normalizeDomain = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  let candidate = value.trim().toLowerCase();
  if (!candidate) {
    return null;
  }

  try {
    if (candidate.startsWith("http")) {
      candidate = new URL(candidate).hostname;
    }
  } catch {
    // ignore parse errors, continue cleanup
  }

  candidate = candidate
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");

  return candidate || null;
};

const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let currentValue = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  const pushValue = () => {
    currentRow.push(currentValue);
    currentValue = "";
  };

  const pushRow = () => {
    rows.push(currentRow);
    currentRow = [];
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"') {
      if (insideQuotes && content[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      pushValue();
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && content[index + 1] === "\n") {
        index += 1;
      }
      pushValue();
      pushRow();
    } else {
      currentValue += char;
    }
  }

  if (currentValue || currentRow.length) {
    pushValue();
    pushRow();
  }

  return rows.filter(
    (row) => row.length && !(row.length === 1 && row[0].trim() === "")
  );
};

const mapRowToObject = (headers: string[], row: string[]): CsvRecord => {
  const record: CsvRecord = {};

  headers.forEach((header, columnIndex) => {
    record[header] = row[columnIndex] ?? "";
  });

  return record;
};

const extractDomain = (website: string | null): string | null => {
  if (!website) {
    return null;
  }

  try {
    const urlValue = website.startsWith("http")
      ? new URL(website)
      : new URL(`https://${website}`);
    return urlValue.hostname.replace(/^www\./, "");
  } catch (error) {
    return null;
  }
};

const parseRevenue = (formattedValue: string | null): number | null => {
  if (!formattedValue) {
    return null;
  }

  const numericPortion = formattedValue.replace(/[^0-9.,-]/g, "");
  if (!numericPortion) {
    return null;
  }

  const normalized = numericPortion.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildCompanyPayload = (
  record: CsvRecord
): Partial<CompaniesAttributes> => {
  const name = sanitize(record.collectorParent);
  const website = sanitize(record.Website);
  const formattedAum = sanitize(record["AUM (Original Currency)"]);

  return {
    name: name ?? record.collectorParent ?? "",
    website_url: website ?? null,
    primary_domain: extractDomain(website) ?? null,
    organization_revenue_printed: formattedAum,
    organization_revenue: parseRevenue(formattedAum),
  };
};

const countFileLines = (content: string): number => {
  const lines = content.split(/\r?\n/);
  if (!lines.length) {
    return 0;
  }

  return lines.reduce((count, line, index) => {
    if (index === 0) {
      return count;
    }

    return line.trim().length ? count + 1 : count;
  }, 0);
};

const dedupeRecords = (records: CsvRecord[]) => {
  const seenKeys = new Map<string, number>();
  const uniqueRecords: CsvRecord[] = [];

  for (const record of records) {
    const primaryKey =
      sanitize(record.ae_lei) ??
      sanitize(record.collectorParent) ??
      record.collectorParent;

    if (!primaryKey) {
      continue;
    }

    const currentCount = seenKeys.get(primaryKey) ?? 0;
    seenKeys.set(primaryKey, currentCount + 1);

    if (currentCount === 0) {
      uniqueRecords.push(record);
    }
  }

  const duplicates = Array.from(seenKeys.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({
      key,
      occurrences: count,
    }));

  return {
    uniqueRecords,
    duplicates,
  };
};

const extractOrganization = (candidate: Record<string, any>) =>
  candidate?.organization ?? candidate ?? {};

const findBestMatch = (
  name: string,
  targetDomain: string | null,
  candidates: any[]
) => {
  if (!Array.isArray(candidates) || !candidates.length) {
    return null;
  }

  const normalizedName = normalizeName(name);

  const evaluated = candidates.map((candidate) => {
    const organization = extractOrganization(candidate);
    const candidateName = normalizeName(
      organization.name ?? organization.organization_name ?? organization.company
    );
    const candidateDomain = normalizeDomain(
      organization.primary_domain ??
        organization.domain ??
        organization.website_url ??
        organization.website ??
        null
    );

    return {
      candidate,
      domainMatches:
        Boolean(targetDomain) &&
        Boolean(candidateDomain) &&
        targetDomain === candidateDomain,
      nameMatches:
        Boolean(normalizedName) &&
        Boolean(candidateName) &&
        normalizedName === candidateName,
    };
  });

  return (
    evaluated.find(
      (item) => item.domainMatches && item.nameMatches
    )?.candidate ??
    evaluated.find((item) => item.domainMatches)?.candidate ??
    evaluated.find((item) => item.nameMatches)?.candidate ??
    candidates[0] ??
    null
  );
};

const searchApolloOrganizations = async (name: string) => {
  try {
    const response = await axios.post(
      APOLLO_ORG_URL,
      {
        q_organization_name: name,
        per_page: 25,
      },
      {
        headers: buildApolloHeaders(),
      }
    );

    const matches =
      response.data?.organizations ?? response.data?.companies ?? [];

    return {
      matches,
      error: null as any,
    };
  } catch (error: any) {
    logger.error(
      {
        name,
        status: error?.response?.status,
        details: error?.response?.data,
        message: error?.message,
      },
      "Apollo organization search failed"
    );
    return {
      matches: [],
      error,
    };
  }
};

const buildNotFoundCsv = (headers: string[], records: CsvRecord[]) => {
  const lines: string[] = [];
  const headerLine = headers
    .map((header) => header.replace(/"/g, '""'))
    .map((header) => `"${header}"`)
    .join(",");
  lines.push(headerLine);

  for (const record of records) {
    const row = headers
      .map((header) => {
        const raw = record[header] ?? "";
        const value = String(raw);
        if (value.includes('"') || value.includes(",") || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(",");
    lines.push(row);
  }

  return lines.join("\n");
};

const upsertCompanyFromMatch = async (
  csvPayload: Partial<CompaniesAttributes>,
  sanitizedName: string,
  match: Record<string, any>
): Promise<"created" | "updated"> => {
  const organization = extractOrganization(match);

  const updatePayload: Partial<CompaniesAttributes> = {
    ...csvPayload,
  };

  const matchNameCandidate =
    typeof organization.name === "string"
      ? organization.name
      : typeof organization.organization_name === "string"
      ? organization.organization_name
      : null;

  if (matchNameCandidate?.trim()) {
    updatePayload.name = matchNameCandidate.trim();
  } else if (sanitizedName) {
    updatePayload.name = sanitizedName;
  }

  const websiteCandidate =
    typeof organization.website_url === "string"
      ? organization.website_url.trim()
      : typeof organization.website === "string"
      ? organization.website.trim()
      : null;
  if (websiteCandidate) {
    updatePayload.website_url = websiteCandidate;
  }

  const domainCandidate =
    normalizeDomain(
      organization.primary_domain ??
        organization.domain ??
        organization.website_url ??
        organization.website ??
        updatePayload.primary_domain ??
        null
    ) ?? updatePayload.primary_domain;
  if (domainCandidate) {
    updatePayload.primary_domain = domainCandidate;
  }

  const externalId =
    typeof organization.id === "string"
      ? organization.id
      : typeof organization.organization_id === "string"
      ? organization.organization_id
      : null;

  if (externalId) {
    updatePayload.external_id = externalId;
  }

  let existingCompany: Companies | null = null;

  if (externalId) {
    existingCompany = await Companies.findOne({
      where: { external_id: externalId },
    });
  }

  if (
    !existingCompany &&
    typeof updatePayload.primary_domain === "string" &&
    updatePayload.primary_domain
  ) {
    existingCompany = await Companies.findOne({
      where: {
        primary_domain: {
          [Op.iLike]: updatePayload.primary_domain,
        },
      },
    });
  }

  if (!existingCompany && sanitizedName) {
    existingCompany = await Companies.findOne({
      where: {
        name: {
          [Op.iLike]: sanitizedName,
        },
      },
    });
  }

  if (existingCompany) {
    await existingCompany.update(updatePayload);
    return "updated";
  }

  await Companies.create(updatePayload as CompaniesAttributes);
  return "created";
};

interface ProcessRecordResult {
  status: "created" | "updated" | "not_found" | "skipped" | "failure";
  record: CsvRecord;
  sanitizedName?: string | null;
  reason?: string;
}

const processRecord = async (
  record: CsvRecord
): Promise<ProcessRecordResult> => {
  const sanitizedName = sanitize(record.collectorParent);
  if (!sanitizedName) {
    return {
      status: "skipped",
      record,
      sanitizedName: null,
      reason: "Company name missing",
    };
  }

  const csvPayload = buildCompanyPayload(record);
  if (!csvPayload.name) {
    csvPayload.name = sanitizedName;
  }
  if (!csvPayload.primary_domain) {
    csvPayload.primary_domain =
      normalizeDomain(csvPayload.website_url ?? null) ?? null;
  }

  const { matches, error } = await searchApolloOrganizations(sanitizedName);
  if (error && !matches.length) {
    const reason =
      error?.response?.data?.error ??
      error?.response?.data?.message ??
      error?.message ??
      "Apollo search failed";
    return {
      status: "failure",
      record,
      sanitizedName,
      reason,
    };
  }

  if (!matches.length) {
    return {
      status: "not_found",
      record,
      sanitizedName,
    };
  }

  const bestMatch = findBestMatch(
    sanitizedName,
    csvPayload.primary_domain,
    matches
  );

  if (!bestMatch) {
    return {
      status: "not_found",
      record,
      sanitizedName,
    };
  }

  try {
    const action = await upsertCompanyFromMatch(
      csvPayload,
      sanitizedName,
      bestMatch
    );
    return {
      status: action,
      record,
      sanitizedName,
    };
  } catch (error: any) {
    logger.error(
      {
        name: sanitizedName,
        message: error?.message,
      },
      "Failed to upsert company"
    );
    return {
      status: "failure",
      record,
      sanitizedName,
      reason: error?.message ?? "Failed to upsert company",
    };
  }
};

interface GetOrganizationsResult {
  importedCount: number;
  totalRowsParsed: number;
  totalLinesInFile: number;
  duplicateCount: number;
  duplicates: Array<{ key: string; occurrences: number }>;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  notFoundCount: number;
  notFoundCsv?: string;
  notFoundFileName?: string;
  lookupFailures: Array<{ name: string; reason: string }>;
}

export const getOrganizations = async (): Promise<GetOrganizationsResult> => {
  try {
    const csvContent = await fs.promises.readFile(CSV_FILE_PATH, "utf-8");
    const grid = parseCsv(csvContent);
    const totalLinesInFile = countFileLines(csvContent);

    if (grid.length < 2) {
      logger.warn("No organization data found in CSV file.");
      return {
        importedCount: 0,
        totalRowsParsed: 0,
        totalLinesInFile,
        duplicateCount: 0,
        duplicates: [],
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        notFoundCount: 0,
        lookupFailures: [],
      };
    }

    const [headerRow, ...dataRows] = grid;
    const normalizedHeaders = headerRow.map((header) => header.trim());

    const rawRecords = dataRows
      .map((row) => mapRowToObject(normalizedHeaders, row))
      .filter((record) => Boolean(sanitize(record.collectorParent)));

    if (!rawRecords.length) {
      logger.warn("Organizations CSV had no valid rows to import.");
      return {
        importedCount: 0,
        totalRowsParsed: 0,
        totalLinesInFile,
        duplicateCount: 0,
        duplicates: [],
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        notFoundCount: 0,
        lookupFailures: [],
      };
    }

    const { uniqueRecords, duplicates } = dedupeRecords(rawRecords);

    const notFoundRecords: CsvRecord[] = [];
    const lookupFailures: Array<{ name: string; reason: string }> = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (
      let index = 0;
      index < uniqueRecords.length;
      index += APOLLO_ORG_CONCURRENCY
    ) {
      const batch = uniqueRecords.slice(
        index,
        index + APOLLO_ORG_CONCURRENCY
      );
      const batchResults = await Promise.all(
        batch.map((record) => processRecord(record))
      );

      for (const result of batchResults) {
        switch (result.status) {
          case "created":
            createdCount += 1;
            break;
          case "updated":
            updatedCount += 1;
            break;
          case "skipped":
            skippedCount += 1;
            notFoundRecords.push(result.record);
            break;
          case "not_found":
            notFoundRecords.push(result.record);
            break;
          case "failure":
            lookupFailures.push({
              name:
                result.sanitizedName ??
                sanitize(result.record.collectorParent) ??
                result.record.collectorParent ??
                "Unknown",
              reason: result.reason ?? "Unknown error",
            });
            notFoundRecords.push(result.record);
            break;
          default:
            break;
        }
      }
    }

    const importedCount = createdCount + updatedCount;

    let notFoundCsv: string | undefined;
    let notFoundFileName: string | undefined;

    if (notFoundRecords.length) {
      const unmatchedHeaders = [...normalizedHeaders];
      for (const record of notFoundRecords) {
        for (const key of Object.keys(record)) {
          if (!unmatchedHeaders.includes(key)) {
            unmatchedHeaders.push(key);
          }
        }
      }
      const csvString = buildNotFoundCsv(unmatchedHeaders, notFoundRecords);
      notFoundCsv = Buffer.from(csvString, "utf-8").toString("base64");
      notFoundFileName = `unmatched-organizations-${Date.now()}.csv`;
    }

    if (duplicates.length) {
      logger.info(
        {
          duplicateCount: duplicates.length,
          duplicates: duplicates.map(
            (dup) => `${dup.key} (${dup.occurrences})`
          ),
        },
        "Skipped duplicate entries while importing organizations"
      );
    }

    return {
      importedCount,
      totalRowsParsed: rawRecords.length,
      totalLinesInFile,
      duplicateCount: duplicates.length,
      duplicates,
      createdCount,
      updatedCount,
      skippedCount,
      notFoundCount: notFoundRecords.length,
      notFoundCsv,
      notFoundFileName,
      lookupFailures,
    };
  } catch (error) {
    logger.error(error, "Failed to import organizations from CSV");
    throw error;
  }
};

export const getOrgs = async (req: Request, res: Response) => {
  try {
    const result = await getOrganizations();

    const {
      notFoundCsv,
      notFoundFileName,
      duplicates,
      lookupFailures,
      ...summary
    } = result;

    const responseData: Record<string, any> = {
      summary,
      duplicates,
      lookupFailures,
    };

    if (notFoundCsv && notFoundFileName) {
      responseData.unmatchedReport = {
        fileName: notFoundFileName,
        csvBase64: notFoundCsv,
      };
    } else {
      responseData.unmatchedReport = null;
    }

    sendResponse(
      res,
      200,
      "Organizations processed successfully",
      responseData
    );
  } catch (error: any) {
    logger.error(
      {
        error: error?.message,
        stack: error?.stack,
      },
      "Failed to process organizations"
    );
    sendResponse(res, 500, "Internal server error", null, error?.message);
  }
};
