const OPEN_ENDED_UPPER_BOUND = 3_000_000;

// Parses "1,001" style groups (first group 1-3 digits, then 3-digit groups) or plain digits.
const parseNumber = (tokens: string[]): number | null => {
  if (!tokens.length) {
    return null;
  }
  if (tokens.length === 1) {
    return /^(0|[1-9]\d*)$/.test(tokens[0]) ? Number(tokens[0]) : null;
  }
  if (!/^[1-9]\d{0,2}$/.test(tokens[0])) {
    return null;
  }
  if (!tokens.slice(1).every((token) => /^\d{3}$/.test(token))) {
    return null;
  }
  return Number(tokens.join(""));
};

/**
 * Converts a range produced by the LLM (e.g. "501,1,000", "1,001,5,000",
 * "10,001+") into the "min,max" format Apollo expects (e.g. "501,1000").
 * Returns null when the range cannot be interpreted unambiguously.
 */
export const normalizeEmployeeRange = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const raw = value.replace(/\s+/g, "");
  if (!raw) {
    return null;
  }

  if (raw.endsWith("+")) {
    const min = parseNumber(raw.slice(0, -1).split(","));
    return min === null ? null : `${min},${Math.max(min, OPEN_ENDED_UPPER_BOUND)}`;
  }

  const tokens = raw.split(",");
  for (let split = 1; split < tokens.length; split++) {
    const min = parseNumber(tokens.slice(0, split));
    const max = parseNumber(tokens.slice(split));
    if (min !== null && max !== null && min < max) {
      return `${min},${max}`;
    }
  }
  return null;
};

export const normalizeEmployeeRanges = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map(normalizeEmployeeRange)
    .filter((range): range is string => range !== null);
  return [...new Set(normalized)];
};
