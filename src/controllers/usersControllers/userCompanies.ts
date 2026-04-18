import { Request, Response } from "express";
import { Op } from "sequelize";
import Companies from "../../models/Companies";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { apolloOrganizationSearch } from "../leadsController/apolloOrganizationSearch";
import { apolloEnrichedOrganization } from "../leadsController/apolloEnrichedOrganization";

type CompanySearchFilters = {
  search: string;
  industry: string;
  city: string;
  country: string;
  minEmployees: number;
  maxEmployees: number;
  minRevenue: number;
  maxRevenue: number;
};

const EMPLOYEE_BUCKETS: Array<[number, number]> = [
  [1, 10],
  [11, 20],
  [21, 50],
  [51, 100],
  [101, 200],
  [201, 500],
  [501, 1000],
  [1001, 2000],
  [2001, 5000],
  [5001, 10000],
  [10001, 20000],
];

const buildWhereClause = ({
  search,
  industry,
  city,
  country,
  minEmployees,
  maxEmployees,
  minRevenue,
  maxRevenue,
}: CompanySearchFilters) => {
  const whereClause: any = {};

  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { industry: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { state: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (industry) {
    whereClause.industry = { [Op.iLike]: `%${industry}%` };
  }

  if (city) {
    whereClause[Op.and] = [
      ...(whereClause[Op.and] || []),
      {
        [Op.or]: [
          { city: { [Op.iLike]: `%${city}%` } },
          { state: { [Op.iLike]: `%${city}%` } },
        ],
      },
    ];
  }

  if (country) {
    whereClause.country = { [Op.iLike]: `%${country}%` };
  }

  if (!Number.isNaN(minEmployees) || !Number.isNaN(maxEmployees)) {
    whereClause.estimated_num_employees = {};
    if (!Number.isNaN(minEmployees)) {
      whereClause.estimated_num_employees[Op.gte] = minEmployees;
    }
    if (!Number.isNaN(maxEmployees)) {
      whereClause.estimated_num_employees[Op.lte] = maxEmployees;
    }
  }

  if (!Number.isNaN(minRevenue) || !Number.isNaN(maxRevenue)) {
    whereClause.organization_revenue = {};
    if (!Number.isNaN(minRevenue)) {
      whereClause.organization_revenue[Op.gte] = minRevenue;
    }
    if (!Number.isNaN(maxRevenue)) {
      whereClause.organization_revenue[Op.lte] = maxRevenue;
    }
  }

  return whereClause;
};

const toApolloEmployeeRanges = (minEmployees: number, maxEmployees: number) => {
  if (Number.isNaN(minEmployees) && Number.isNaN(maxEmployees)) {
    return undefined;
  }

  const normalizedMin = Number.isNaN(minEmployees) ? 1 : Math.max(1, minEmployees);
  const normalizedMax = Number.isNaN(maxEmployees)
    ? Number.POSITIVE_INFINITY
    : Math.max(normalizedMin, maxEmployees);

  const ranges = EMPLOYEE_BUCKETS
    .filter(([bucketMin, bucketMax]) => bucketMax >= normalizedMin && bucketMin <= normalizedMax)
    .map(([bucketMin, bucketMax]) => `${bucketMin},${bucketMax}`);

  if (normalizedMax === Number.POSITIVE_INFINITY) {
    const [lastBucketMin, lastBucketMax] = EMPLOYEE_BUCKETS[EMPLOYEE_BUCKETS.length - 1];
    if (normalizedMin <= lastBucketMax) {
      return ranges;
    }
    return [`${lastBucketMin},${lastBucketMax}`];
  }

  return ranges.length ? ranges : undefined;
};

const buildApolloSearchParams = ({
  search,
  industry,
  city,
  country,
  minEmployees,
  maxEmployees,
  minRevenue,
  maxRevenue,
}: CompanySearchFilters) => {
  const organizationLocations = [city, country].filter(Boolean);
  const organizationNumEmployeesRanges = toApolloEmployeeRanges(
    minEmployees,
    maxEmployees,
  );

  return {
    ...(search ? { q_organization_name: search } : {}),
    ...(industry ? { q_organization_keyword_tags: [industry] } : {}),
    ...(organizationLocations.length
      ? { organization_locations: organizationLocations }
      : {}),
    ...(organizationNumEmployeesRanges?.length
      ? { organization_num_employees_ranges: organizationNumEmployeesRanges }
      : {}),
    ...(!Number.isNaN(minRevenue) ? { "revenue_range[min]": minRevenue } : {}),
    ...(!Number.isNaN(maxRevenue) ? { "revenue_range[max]": maxRevenue } : {}),
  };
};

const dedupeApolloOrganizations = (organizations: any[] = []) => {
  const seen = new Set<string>();

  return organizations.filter((organization) => {
    if (!organization?.id || seen.has(organization.id)) {
      return false;
    }
    seen.add(organization.id);
    return true;
  });
};

const sanitizeDomain = (raw?: string | null) => {
  if (!raw) {
    return null;
  }

  let candidate = raw.trim().toLowerCase();
  if (!candidate) {
    return null;
  }

  try {
    if (candidate.startsWith("http")) {
      candidate = new URL(candidate).hostname;
    }
  } catch {
    // Keep sanitized fallback below.
  }

  candidate = candidate
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");

  return candidate || null;
};

const mergeSearchAndEnrichedOrganizations = (
  organizations: any[],
  enrichedOrganizations: any[],
) => {
  const enrichedByDomain = new Map<string, any>();
  const enrichedById = new Map<string, any>();

  enrichedOrganizations.forEach((organization) => {
    const domain = sanitizeDomain(
      organization?.primary_domain || organization?.website_url,
    );

    if (domain) {
      enrichedByDomain.set(domain, organization);
    }

    if (organization?.id) {
      enrichedById.set(organization.id, organization);
    }
  });

  return organizations.map((organization) => {
    const domain = sanitizeDomain(
      organization?.primary_domain || organization?.website_url,
    );

    return (
      (domain ? enrichedByDomain.get(domain) : undefined) ||
      (organization?.id ? enrichedById.get(organization.id) : undefined) ||
      organization
    );
  });
};

const persistApolloOrganizations = async (organizations: any[]) => {
  if (!organizations.length) {
    return [];
  }

  const externalIds = organizations
    .map((organization) => organization?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (!externalIds.length) {
    return [];
  }

  const existingCompanies = await Companies.findAll({
    where: { external_id: { [Op.in]: externalIds } },
    attributes: ["external_id"],
    raw: true,
  });

  const existingExternalIds = new Set(
    existingCompanies
      .map((company: any) => company.external_id)
      .filter((id: string | null) => typeof id === "string" && id.length > 0),
  );

  const companiesToCreate = organizations
    .filter((organization) => !existingExternalIds.has(organization.id))
    .map((organization) => {
      const { id, ...companyInfo } = organization;
      return {
        ...companyInfo,
        external_id: id,
      };
    });

  if (companiesToCreate.length) {
    await Companies.bulkCreate(companiesToCreate);
  }

  const savedCompanies = await Companies.findAll({
    where: { external_id: { [Op.in]: externalIds } },
  });

  const companyByExternalId = new Map(
    savedCompanies.map((company) => [company.external_id, company]),
  );

  return externalIds
    .map((externalId) => companyByExternalId.get(externalId))
    .filter(Boolean);
};

export const userCompanies = async (request: Request, response: Response) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = String(request.query.search || "").trim();
    const industry = String(request.query.industry || "").trim();
    const city = String(request.query.city || "").trim();
    const country = String(request.query.country || "").trim();
    const minEmployees = Number(request.query.minEmployees);
    const maxEmployees = Number(request.query.maxEmployees);
    const minRevenue = Number(request.query.minRevenue);
    const maxRevenue = Number(request.query.maxRevenue);
    const filters: CompanySearchFilters = {
      search,
      industry,
      city,
      country,
      minEmployees,
      maxEmployees,
      minRevenue,
      maxRevenue,
    };
    const whereClause = buildWhereClause(filters);

    const { count, rows } = await Companies.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    if (rows.length < limit && search) {
      const apolloResponse = await apolloOrganizationSearch(
        buildApolloSearchParams(filters),
        1,
        100,
      );

      const organizations = dedupeApolloOrganizations(
        apolloResponse?.organizations || [],
      );

      if (organizations.length) {
        const enrichmentDomains = organizations
          .map((organization) =>
            sanitizeDomain(
              organization?.primary_domain || organization?.website_url,
            ),
          )
          .filter((domain): domain is string => Boolean(domain));

        const enrichedOrganizations = enrichmentDomains.length
          ? await apolloEnrichedOrganization(enrichmentDomains)
          : [];

        const organizationsToPersist = dedupeApolloOrganizations(
          mergeSearchAndEnrichedOrganizations(
            organizations,
            enrichedOrganizations,
          ),
        );

        await persistApolloOrganizations(organizationsToPersist);

        const refreshedResult = await Companies.findAndCountAll({
          where: whereClause,
          limit,
          offset,
          order: [["createdAt", "DESC"]],
        });

        sendResponse(response, 200, "Companies fetched successfully", {
          companies: refreshedResult.rows,
          total: refreshedResult.count,
          page,
          totalPages: Math.max(
            1,
            Math.ceil(refreshedResult.count / limit),
          ),
          source: "apollo",
        });
        return;
      }
    }

    sendResponse(response, 200, "Companies fetched successfully", {
      companies: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error: any) {
    logger.error(error, "Error fetching companies for user");
    sendResponse(response, 500, "Internal server error", null, error.message);
  }
};

export const userCompanyFilterOptions = async (
  _request: Request,
  response: Response
) => {
  try {
    const [industryRows, countryRows] = await Promise.all([
      Companies.findAll({
        attributes: ["industry"],
        where: {
          industry: {
            [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }],
          },
        },
        group: ["industry"],
        order: [["industry", "ASC"]],
        raw: true,
      }),
      Companies.findAll({
        attributes: ["country"],
        where: {
          country: {
            [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }],
          },
        },
        group: ["country"],
        order: [["country", "ASC"]],
        raw: true,
      }),
    ]);

    sendResponse(response, 200, "Company filter options fetched successfully", {
      industries: industryRows
        .map((row: any) => row.industry)
        .filter(Boolean),
      countries: countryRows
        .map((row: any) => row.country)
        .filter(Boolean),
    });
  } catch (error: any) {
    logger.error(error, "Error fetching company filter options");
    sendResponse(response, 500, "Internal server error", null, error.message);
  }
};
