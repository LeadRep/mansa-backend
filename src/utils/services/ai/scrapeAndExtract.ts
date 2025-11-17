import { scrapeWebsite } from "../../scraper";
import axios from "axios";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { getAICompletion } from "./openai";

const extractionPrompt = (scrapedData: { text: string }) => {
  return `
    Based on the following text from a website, please extract the following information and return it as a JSON object.

    Website Text:
    ---
    ${scrapedData.text}
    ---

    Please extract the following fields:
    - "AUM": Assets Under Management (e.g., "$10 billion", "€5.2M").
    - "Equities": Mention of equities as a percentage or strategy.
    - "FixedIncome": Mention of fixed income as a percentage or strategy.
    - "ETFs": Mention of ETFs as a percentage or strategy.
    - "ExternalManagers": Mention of using external managers.
    - "keywords": An array of keywords found on the page. The keywords to look for are: "single family office", "multi-family office", "wealth management", "RIA", "asset management", "investment management", "hedge fund", "private equity", "venture capital", "pension fund", "endowment", "foundation", "family office".

    Your response should be a JSON object with the extracted data. For example:
    {
      "AUM": "$1.5 Billion",
      "Equities": "40% of portfolio",
      "FixedIncome": "30% of portfolio",
      "ETFs": "Not mentioned",
      "ExternalManagers": "Mentioned",
      "keywords": ["wealth management", "asset management"]
    }
  `;
};

export const scrapeAndExtract = async (url: string) => {
  try {
    const scrapedResult = await scrapeWebsite(url, {
      mode: "site",
      maxPages: 10,
      includeHtml: false,
    });

    // Gather and log PDF links collected by the scraper
    const pdfLinks = (() => {
      type WithPdfs = { pdfLinks?: string[] };
      if (Array.isArray(scrapedResult)) {
        const all = scrapedResult
          .flatMap((p) => (p as unknown as WithPdfs)?.pdfLinks ?? [])
          .filter(Boolean);
        return Array.from(new Set(all));
      }
      return Array.from(
        new Set(
          ((scrapedResult as unknown as WithPdfs)?.pdfLinks ?? []).filter(
            Boolean
          )
        )
      );
    })();

    const pdfTexts: string[] = [];
    if (pdfLinks.length) {
      const pdfParseModule: any = require("pdf-parse");
      const PDFParseClass: any = pdfParseModule?.PDFParse;
      const pdfParseFn: any =
        typeof pdfParseModule === "function"
          ? pdfParseModule
          : typeof pdfParseModule?.default === "function"
          ? pdfParseModule.default
          : null;

      const parsePdfBuffer = async (buf: Buffer): Promise<string> => {
        // Prefer v2 class API if available
        if (typeof PDFParseClass === "function") {
          const VerbosityLevel: any = (pdfParseModule as any)?.VerbosityLevel;
          const loadParams: any = {
            data: buf,
            verbosity: VerbosityLevel?.ERRORS ?? 0,
          };
          const parser = new PDFParseClass(loadParams);
          try {
            const out = await parser.getText({});
            return (out?.text || "").trim();
          } finally {
            try {
              await parser.destroy();
            } catch {}
          }
        }

        // Fall back to legacy function API
        if (pdfParseFn) {
          const out = await pdfParseFn(buf);
          return (out?.text || "").trim();
        }

        throw new Error("No compatible pdf-parse API available");
      };
      const ensureDir = async (dir: string) => {
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch {}
      };

      const toSafeFilename = (u: string): string => {
        try {
          const uo = new URL(u);
          const base = path.basename(uo.pathname) || "download.pdf";
          let ext = path.extname(base).toLowerCase();
          let stem = base.slice(0, base.length - ext.length);
          if (!ext || ext !== ".pdf") {
            // Force .pdf extension
            ext = ".pdf";
          }
          // Sanitize stem only (keep a single .pdf at the end)
          stem = stem.replace(/[^A-Za-z0-9._-]+/g, "_");
          // Add short rev tag before extension if present
          const rev = uo.searchParams.get("rev");
          const tag = rev ? `_${rev.slice(0, 8)}` : "";
          const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
          return `${unique}_${stem}${tag}${ext}`;
        } catch {
          return `${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
        }
      };

      const fetchOne = async (u: string) => {
        try {
          const res = await axios.get<ArrayBuffer>(u, {
            responseType: "arraybuffer",
            timeout: 30000,
            headers: {
              Accept: "application/pdf,*/*",
              "User-Agent":
                "Mozilla/5.0 (compatible; MansaBot/1.0; +https://example.com/bot)",
            },
          });

          const pdfDir = path.resolve(process.cwd(), "exports", "scrapePDF");
          await ensureDir(pdfDir);
          const filename = toSafeFilename(u);
          const tmpFile = path.join(pdfDir, filename);

          const buf = Buffer.from(res.data);
          await fs.writeFile(tmpFile, buf);
          console.log("Saved PDF to:", tmpFile);
          const fileBuf = await fs.readFile(tmpFile);
          const text = await parsePdfBuffer(fileBuf);
          if (text) pdfTexts.push(text);
        } catch (err) {
          console.warn(
            "Failed to fetch/parse PDF:",
            u,
            (err as Error)?.message
          );
        }
      };
      await Promise.all(pdfLinks.map((u) => fetchOne(u)));
    }

    const combinedText = Array.isArray(scrapedResult)
      ? scrapedResult
          .map((p) => (p as { text?: string })?.text || "")
          .filter(Boolean)
          .join("\n\n")
      : (scrapedResult as unknown as { text?: string })?.text || "";

    const pdfCombined = pdfTexts.filter(Boolean).join("\n\n");
    const fullText = pdfCombined
      ? combinedText
          .concat("\n\n---\n\n")
          .concat("PDF Content:\n\n")
          .concat(pdfCombined)
      : combinedText;

    // Prefer relevance-based excerpts over blunt truncation
    const KEYWORDS = [
      "aum",
      "assets under management",
      "equities",
      "equity",
      "fixed income",
      "bond",
      "etf",
      "exchange-traded fund",
      "external managers",
      "third-party managers",
      "outsourced",
      "wealth management",
      "asset management",
      "investment management",
      "hedge fund",
      "private equity",
      "venture capital",
      "pension fund",
      "endowment",
      "foundation",
      "family office",
      "ria",
    ];

    const collectRelevantExcerpts = (
      text: string,
      keywords: string[],
      windowChars = 800,
      maxExcerpts = 50
    ): string[] => {
      const lc = text.toLowerCase();
      const seen = new Set<string>();
      const excerpts: string[] = [];
      for (const kw of keywords) {
        let from = 0;
        const needle = kw.toLowerCase();
        while (from < lc.length) {
          const idx = lc.indexOf(needle, from);
          if (idx === -1) break;
          const start = Math.max(0, idx - Math.floor(windowChars / 2));
          const end = Math.min(lc.length, idx + Math.floor(windowChars / 2));
          // Expand to nearest paragraph boundaries when possible
          const paraStart = text.lastIndexOf("\n\n", start);
          const paraEnd = text.indexOf("\n\n", end);
          const s = paraStart >= 0 ? paraStart + 2 : start;
          const e = paraEnd >= 0 ? paraEnd : end;
          const snippet = text.slice(s, e).trim();
          if (snippet && !seen.has(snippet)) {
            seen.add(snippet);
            excerpts.push(snippet);
            if (excerpts.length >= maxExcerpts) return excerpts;
          }
          from = idx + needle.length;
        }
        if (excerpts.length >= maxExcerpts) break;
      }
      return excerpts;
    };

    const relevant = collectRelevantExcerpts(fullText, KEYWORDS, 900, 60);

    const buildPromptText = (text: string) =>
      text
        .replace(/\r/g, "")
        .replace(/[\t ]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    let promptText: string;
    if (relevant.length > 0) {
      promptText = buildPromptText(
        [
          "Relevant Excerpts:",
          ...relevant.map((s, i) => `--- Excerpt ${i + 1} ---\n${s}`),
        ].join("\n\n")
      );
    } else {
      promptText = buildPromptText(fullText);
    }

    // Clamp as a final safeguard
    const MAX_PROMPT_CHARS = 40000;
    if (promptText.length > MAX_PROMPT_CHARS) {
      const cutAt = promptText.lastIndexOf("\n", MAX_PROMPT_CHARS);
      const clamped = promptText.slice(0, cutAt > 0 ? cutAt : MAX_PROMPT_CHARS);
      console.log(
        `Scrape text truncated for AI: ${promptText.length} -> ${clamped.length} chars`
      );
      promptText = clamped;
    }

    const scrapedData = { text: promptText };
    if (!scrapedData || !scrapedData.text) {
      throw new Error("Failed to scrape or extract text from the URL.");
    }

    const prompt = extractionPrompt(scrapedData);
    const extractedDataString = await getAICompletion(prompt);

    if (!extractedDataString) {
      throw new Error("AI did not return any data.");
    }

    // Be tolerant to minor formatting like code fences or extra text
    const cleaned = (() => {
      let s = extractedDataString.trim();
      if (s.startsWith("```json")) {
        s = s
          .replace(/^```json/, "")
          .replace(/```$/, "")
          .trim();
      } else if (s.startsWith("```")) {
        s = s.replace(/^```/, "").replace(/```$/, "").trim();
      }
      return s;
    })();

    const extractFirstJsonObject = (s: string): string => {
      const start = s.indexOf("{");
      if (start === -1) return s;
      let depth = 0;
      for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            return s.slice(start, i + 1);
          }
        }
      }
      // Fallback to original if braces not balanced
      return s.slice(start);
    };

    const jsonCandidate = extractFirstJsonObject(cleaned);
    return JSON.parse(jsonCandidate);
  } catch (error) {
    console.error("Error in scrapeAndExtract:", error);
    throw new Error("Failed to scrape and extract data.");
  }
};
