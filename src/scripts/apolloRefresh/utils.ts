import crypto from "crypto";

export interface CliArgs {
  [key: string]: string | boolean | undefined;
}

export const parseCliArgs = (argv: string[]): CliArgs => {
  const out: CliArgs = {};
  for (const rawArg of argv) {
    if (!rawArg.startsWith("--")) {
      continue;
    }
    const arg = rawArg.slice(2);
    const [key, value] = arg.split("=");
    if (!key) {
      continue;
    }
    if (typeof value === "undefined") {
      out[key] = true;
      continue;
    }
    out[key] = value;
  }
  return out;
};

export const getStringArg = (
  args: CliArgs,
  key: string,
  fallback = ""
): string => {
  const value = args[key];
  return typeof value === "string" ? value : fallback;
};

export const getBooleanArg = (
  args: CliArgs,
  key: string,
  fallback = false
): boolean => {
  const value = args[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
};

export const getNumberArg = (
  args: CliArgs,
  key: string,
  fallback: number
): number => {
  const value = args[key];
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

export const parseCsvArg = (value: string): string[] => {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const uniqueStrings = (values: string[]): string[] => {
  return Array.from(new Set(values));
};

const canonicalize = (value: any): any => {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(value[key]);
    }
    return result;
  }
  return value;
};

export const stableHash = (value: unknown): string => {
  const normalized = canonicalize(value);
  const encoded = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(encoded).digest("hex");
};

export const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  const size = Math.max(1, chunkSize);
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export const trimToNullable = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeForDiff = (value: unknown): unknown => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeForDiff(item))
      .filter((item) => item !== null);

    const allStrings = normalized.every((item) => typeof item === "string");
    if (allStrings) {
      return (normalized as string[]).sort();
    }
    return normalized;
  }

  if (typeof value === "object") {
    return canonicalize(value);
  }

  return value;
};
