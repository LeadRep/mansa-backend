import { Op } from "sequelize";
import { GeneralLeads } from "../../models/GeneralLeads";
import { ApolloPerson } from "./types";

const uniqStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
};

const parseEmployeeRange = (value: string): { min: number; max: number } | null => {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }
  const min = Math.min(parts[0], parts[1]);
  const max = Math.max(parts[0], parts[1]);
  return { min, max };
};

const parseLooseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/,/g, "");
  if (!normalized) {
    return null;
  }

  const multiplier =
    normalized.endsWith("b") || normalized.includes(" billion")
      ? 1_000_000_000
      : normalized.endsWith("m") || normalized.includes(" million")
        ? 1_000_000
        : normalized.endsWith("k") || normalized.includes(" thousand")
          ? 1_000
          : 1;

  const numericPart = normalized.replace(/[^0-9.]/g, "");
  if (!numericPart) {
    return null;
  }

  const parsed = Number(numericPart);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed * multiplier;
};

const extractOrgValue = (organization: any, keys: string[]): unknown => {
  if (!organization || typeof organization !== "object") {
    return null;
  }
  for (const key of keys) {
    if (organization[key] !== undefined && organization[key] !== null) {
      return organization[key];
    }
  }
  return null;
};

const extractEmployeesCount = (lead: any): number | null => {
  const organization = lead?.organization;
  const direct = extractOrgValue(organization, [
    "estimated_num_employees",
    "estimatedNumEmployees",
    "employees_count",
    "employee_count",
    "num_employees",
  ]);
  return parseLooseNumber(direct);
};

const extractRevenue = (lead: any): number | null => {
  const organization = lead?.organization;

  const rangeMin = parseLooseNumber(
    extractOrgValue(organization, ["revenue_range_min", "revenue_min", "annual_revenue_min"])
  );
  const rangeMax = parseLooseNumber(
    extractOrgValue(organization, ["revenue_range_max", "revenue_max", "annual_revenue_max"])
  );
  if (rangeMin !== null && rangeMax !== null) {
    return (rangeMin + rangeMax) / 2;
  }

  const direct = extractOrgValue(organization, [
    "annual_revenue",
    "estimated_annual_revenue",
    "revenue",
  ]);
  return parseLooseNumber(direct);
};

const buildGeneralLeadsFilters = (
  aiQueryParams: Record<string, any> | null | undefined,
  excludeExternalIds: string[]
) => {
  const where: Record<string, any> = {};
  const andConditions: any[] = [];

  const externalIdConditions: any[] = [{ [Op.ne]: null }];
  if (excludeExternalIds.length) {
    externalIdConditions.push({ [Op.notIn]: excludeExternalIds });
  }
  where.external_id = { [Op.and]: externalIdConditions };

  const personTitles = uniqStrings(aiQueryParams?.person_titles);
  if (personTitles.length) {
    andConditions.push({
      [Op.or]: personTitles.map((title: string) => ({
        title: { [Op.iLike]: `%${title}%` },
      })),
    });
  }

  const locations = uniqStrings(aiQueryParams?.organization_locations);
  if (locations.length) {
    andConditions.push({
      [Op.or]: [
        ...locations.map((location) => ({ country: { [Op.iLike]: `%${location}%` } })),
        ...locations.map((location) => ({ state: { [Op.iLike]: `%${location}%` } })),
        ...locations.map((location) => ({ city: { [Op.iLike]: `%${location}%` } })),
      ],
    });
  }

  const seniorities = uniqStrings(aiQueryParams?.person_seniorities);
  if (seniorities.length) {
    andConditions.push({
      [Op.or]: seniorities.map((seniority: string) => ({
        seniority: { [Op.iLike]: `%${seniority}%` },
      })),
    });
  }

  if (andConditions.length) {
    (where as any)[Op.and] = andConditions;
  }

  return where;
};

const toApolloLikePerson = (lead: any): ApolloPerson => ({
  id: lead.external_id ?? lead.id ?? null,
  first_name: lead.first_name ?? null,
  last_name: lead.last_name ?? null,
  full_name: lead.full_name ?? null,
  name: lead.full_name ?? lead.name ?? null,
  linkedin_url: lead.linkedin_url ?? null,
  title: lead.title ?? null,
  photo_url: lead.photo_url ?? null,
  twitter_url: lead.twitter_url ?? null,
  github_url: lead.github_url ?? null,
  facebook_url: lead.facebook_url ?? null,
  headline: lead.headline ?? null,
  email: lead.email ?? null,
  phone_numbers: lead.phone ? [{ number: lead.phone }] : [],
  organization: lead.organization ?? null,
  departments: lead.departments ?? null,
  state: lead.state ?? null,
  city: lead.city ?? null,
  country: lead.country ?? null,
});

export const searchGeneralLeads = async (
  aiQueryParams: Record<string, any> | null | undefined,
  excludeExternalIds: string[],
  limit: number
) => {
  const employeeRanges = uniqStrings(aiQueryParams?.organization_num_employees_ranges)
    .map(parseEmployeeRange)
    .filter((range): range is { min: number; max: number } => Boolean(range));
  const revenueMin = parseLooseNumber(aiQueryParams?.["revenue_range[min]"]);
  const revenueMax = parseLooseNumber(aiQueryParams?.["revenue_range[max]"]);

  const where = buildGeneralLeadsFilters(aiQueryParams, excludeExternalIds);
  const rows = await GeneralLeads.findAll({
    where,
    order: [["createdAt", "DESC"]],
    // Pull a wider candidate set because some filters (employees/revenue) are applied in-memory.
    limit: Math.max(limit, 1) * 5,
  });

  const people: ApolloPerson[] = [];
  const ids: string[] = [];

  for (const row of rows) {
    if (people.length >= limit) {
      break;
    }

    if (employeeRanges.length) {
      const employees = extractEmployeesCount(row);
      const inEmployeeRange =
        employees !== null &&
        employeeRanges.some((range) => employees >= range.min && employees <= range.max);
      if (!inEmployeeRange) {
        continue;
      }
    }

    if (revenueMin !== null || revenueMax !== null) {
      const revenue = extractRevenue(row);
      if (revenue === null) {
        continue;
      }
      if (revenueMin !== null && revenue < revenueMin) {
        continue;
      }
      if (revenueMax !== null && revenue > revenueMax) {
        continue;
      }
    }

    const person = toApolloLikePerson(row);
    if (!person.id) {
      continue;
    }
    people.push(person);
    ids.push(person.id);
  }

  return { people, ids };
};
