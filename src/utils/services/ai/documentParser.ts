import fs from "fs";
import path from "path";
import logger from "../../../logger";

let pdfParse: any = null;
try {
  pdfParse = require("pdf-parse");
} catch (err) {
  logger.warn("pdf-parse not loaded synchronously; will require dynamically");
}

export interface ExtractedDocument {
  title: string;
  text: string;
  fileType: string;
  fileSize: number;
}

export async function parseDocumentFile(
  filePath: string,
  originalFilename: string,
  mimeType: string
): Promise<ExtractedDocument> {
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  const ext = path.extname(originalFilename).toLowerCase();

  let text = "";

  if (ext === ".pdf" || mimeType === "application/pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const pdf = typeof pdfParse === "function" ? pdfParse : require("pdf-parse");
    const parsed = await pdf(dataBuffer);
    text = parsed.text || "";
  } else if (
    ext === ".txt" ||
    ext === ".md" ||
    ext === ".markdown" ||
    ext === ".csv" ||
    ext === ".json" ||
    mimeType.startsWith("text/")
  ) {
    text = fs.readFileSync(filePath, "utf-8");
  } else {
    // Attempt fallback read as UTF-8
    try {
      text = fs.readFileSync(filePath, "utf-8");
    } catch (err: any) {
      throw new Error(`Unsupported document format: ${ext || mimeType}`);
    }
  }

  // Clean and normalize text
  text = cleanText(text);

  if (!text || text.trim().length === 0) {
    throw new Error("No readable text could be extracted from the file.");
  }

  return {
    title: originalFilename,
    text,
    fileType: mimeType || ext,
    fileSize,
  };
}

export function cleanText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ +/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
