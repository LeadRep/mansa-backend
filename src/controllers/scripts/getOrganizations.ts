import fs from "fs";
import path from "path";
import Companies, { CompaniesAttributes } from "../../models/Companies";
import sendResponse from "../../utils/http/sendResponse";
import { Request, Response } from "express";

type CsvRecord = Record<string, string>;

const CSV_FILE_PATH = path.resolve(
  __dirname,
  "../../../exports/scr/organizationsFile.csv"
);

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
    name: name ?? "",
    website_url: website,
    primary_domain: extractDomain(website),
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

export const getOrganizations = async (): Promise<{
  importedCount: number;
  totalRowsParsed: number;
  totalLinesInFile: number;
  duplicateCount: number;
  duplicates: Array<{ key: string; occurrences: number }>;
}> => {
  try {
    const csvContent = await fs.promises.readFile(CSV_FILE_PATH, "utf-8");
    const grid = parseCsv(csvContent);
    const totalLinesInFile = countFileLines(csvContent);

    if (grid.length < 2) {
      console.log("No organization data found in CSV file.");
      return {
        importedCount: 0,
        totalRowsParsed: 0,
        totalLinesInFile,
        duplicateCount: 0,
        duplicates: [],
      };
    }

    const [headerRow, ...dataRows] = grid;
    const normalizedHeaders = headerRow.map((header) => header.trim());

    const rawRecords = dataRows
      .map((row) => mapRowToObject(normalizedHeaders, row))
      .filter((record) => Boolean(sanitize(record.collectorParent)));

    if (!rawRecords.length) {
      console.log("Organizations CSV had no valid rows to import.");
      return {
        importedCount: 0,
        totalRowsParsed: 0,
        totalLinesInFile,
        duplicateCount: 0,
        duplicates: [],
      };
    }

    const { uniqueRecords, duplicates } = dedupeRecords(rawRecords);

    const companiesPayload = uniqueRecords.map((record) =>
      buildCompanyPayload(record)
    );

    await Companies.bulkCreate(companiesPayload as CompaniesAttributes[], {
      updateOnDuplicate: [
        "website_url",
        "primary_domain",
        "organization_revenue_printed",
        "organization_revenue",
      ],
    });

    const importedCount = companiesPayload.length;
    console.log(`Imported ${importedCount} organizations.`);
    if (duplicates.length) {
      console.log(
        `Skipped ${duplicates.length} duplicate entries:`,
        duplicates.map((dup) => `${dup.key} (${dup.occurrences})`).join(", ")
      );
    }

    return {
      importedCount,
      totalRowsParsed: rawRecords.length,
      totalLinesInFile,
      duplicateCount: duplicates.length,
      duplicates,
    };
  } catch (error) {
    console.error("Failed to import organizations from CSV.", error);
    throw error;
  }
};

export const getOrgs = async (req: Request, res: Response) => {
  try {
    const result = await getOrganizations();
    sendResponse(res, 200, "Organizations fetched successfully", result);
    return;
  } catch (error: any) {
    console.log("Error :", error.message);
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
