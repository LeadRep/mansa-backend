import puppeteer, { Browser } from "puppeteer";

export type ScrapeMode = "single" | "site";

export interface ScrapeOptions {
  mode?: ScrapeMode; // 'single' (default) or 'site'
  maxPages?: number; // only for 'site' mode; safeguards breadth
  sameOriginOnly?: boolean; // restrict crawling to same origin
  includeSubdomains?: boolean; // allow subdomains when sameOriginOnly
  concurrency?: number; // parallel pages when in 'site' mode
  timeoutMs?: number; // per-page navigation timeout
  delayMs?: number; // polite delay between requests
  includeHtml?: boolean; // include raw HTML in results
}

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
  html?: string;
  status?: number;
  pdfLinks?: string[];
}

function normalizeUrl(input: string): string {
  const s = input.trim();
  if (!/^https?:\/\//i.test(s)) return `https://${s}`;
  return s;
}

function stripHash(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPdfUrl(u: string): boolean {
  try {
    const url = new URL(u);
    const pathname = url.pathname.toLowerCase();
    return pathname.endsWith(".pdf");
  } catch {
    // Fallback heuristic
    return /\.pdf(?:[?#]|$)/i.test(u);
  }
}

function isAllowedByOrigin(
  href: string,
  base: URL,
  sameOriginOnly: boolean,
  includeSubdomains: boolean
): boolean {
  if (!sameOriginOnly) return true;
  try {
    const url = new URL(href);
    if (url.origin === base.origin) return true;
    if (!includeSubdomains) return false;
    // allow foo.basehost for subdomains when enabled
    const baseHost = base.hostname;
    return url.hostname.endsWith(`.${baseHost}`);
  } catch {
    return false;
  }
}

async function politeDelay(ms?: number) {
  if (!ms || ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

async function scrapeOne(
  browser: Browser,
  url: string,
  opts: Required<Pick<ScrapeOptions, "timeoutMs" | "includeHtml">>
): Promise<ScrapedPage & { links: string[] } | null> {
  const page = await browser.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs,
    });

    // Title, text and optional HTML
    const title = (await page.title()) || "";
    const text = await page.evaluate(() => document.body?.innerText || "");
    const html = opts.includeHtml
      ? await page.evaluate(() => document.documentElement?.outerHTML || "")
      : undefined;

    // Extract candidate links on the page
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean)
    );

    return {
      url,
      title: title.trim(),
      text: (text || "").trim(),
      html,
      status: response?.status(),
      links: links.map(stripHash),
    };
  } catch {
    return null;
  } finally {
    try {
      await page.close();
    } catch {}
  }
}

export async function scrapeWebsite(
  inputUrl: string,
  options: ScrapeOptions = {}
): Promise<ScrapedPage | ScrapedPage[]> {
  const {
    mode = "single",
    maxPages = 50,
    sameOriginOnly = true,
    includeSubdomains = false,
    concurrency = 3,
    timeoutMs = 30000,
    delayMs = 0,
    includeHtml = false,
  } = options;

  const startUrl = normalizeUrl(inputUrl);
  const baseUrl = new URL(startUrl);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    if (mode === "single") {
      const single = await scrapeOne(browser, startUrl, { timeoutMs, includeHtml });
      const pdfLinks =
        single?.links
          ?.filter((href) => isHttpUrl(href) && isPdfUrl(href))
          ?.filter((href) =>
            isAllowedByOrigin(href, baseUrl, sameOriginOnly, includeSubdomains)
          ) || [];

      return (
        single && {
          url: single.url,
          title: single.title,
          text: single.text,
          html: single.html,
          status: single.status,
          pdfLinks,
        }
      ) as ScrapedPage; // may be undefined if navigation failed
    }

    // Site mode: BFS crawl within constraints
    const results: ScrapedPage[] = [];
    const visited = new Set<string>();
    const queue: string[] = [startUrl];

    while (queue.length && results.length < maxPages) {
      const batch = queue.splice(0, Math.max(1, Math.min(concurrency, maxPages - results.length)));

      const batchResults = await Promise.all(
        batch.map(async (u) => {
          if (visited.has(u)) return null;
          visited.add(u);
          const item = await scrapeOne(browser, u, { timeoutMs, includeHtml });
          await politeDelay(delayMs);
          return item;
        })
      );

      for (const item of batchResults) {
        if (!item) continue;
        const pagePdfLinks = item.links
          .filter((href) => isHttpUrl(href) && isPdfUrl(href))
          .filter((href) =>
            isAllowedByOrigin(href, baseUrl, sameOriginOnly, includeSubdomains)
          );
        results.push({
          url: item.url,
          title: item.title,
          text: item.text,
          html: item.html,
          status: item.status,
          pdfLinks: pagePdfLinks,
        });

        if (results.length >= maxPages) break;

        // enqueue new links respecting constraints
        for (const href of item.links) {
          if (!href || !isHttpUrl(href)) continue;
          // Do not crawl PDFs; collect them separately above
          if (isPdfUrl(href)) continue;
          if (!isAllowedByOrigin(href, baseUrl, sameOriginOnly, includeSubdomains)) continue;
          if (!visited.has(href) && !queue.includes(href)) {
            queue.push(href);
          }
          if (queue.length + results.length >= maxPages) break;
        }
      }
    }

    return results;
  } finally {
    try {
      await browser.close();
    } catch {}
  }
}

// Convenience export for single-page usage
export async function scrapeSinglePage(
  url: string,
  options: Omit<ScrapeOptions, "mode"> = {}
): Promise<ScrapedPage> {
  return (await scrapeWebsite(url, { ...options, mode: "single" })) as ScrapedPage;
}

// Convenience export for site-wide usage
export async function scrapeEntireSite(
  url: string,
  options: Omit<ScrapeOptions, "mode"> = {}
): Promise<ScrapedPage[]> {
  return (await scrapeWebsite(url, { ...options, mode: "site" })) as ScrapedPage[];
}
