import { Request, Response } from "express";
import { Op } from "sequelize";
import Companies from "../../models/Companies";
import { GeneralLeads } from "../../models/GeneralLeads";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { apolloService } from "../../utils/http/services/apolloService";
import { apolloEnrichedPeople } from "../leadsController/apolloEnrichedPeople";
import { persistApolloResults } from "../leadGenV2/persistApolloResults";

type CompanyPeopleFilters = {
  search: string;
  title: string;
  seniority: string[];
  department: string;
  location: string;
};

const parseSeniority = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
};

const buildWhereClause = (
  organizationExternalId: string,
  { search, title, seniority, department, location }: CompanyPeopleFilters
) => {
  const whereClause: any = { organization_id: organizationExternalId };

  if (search) {
    whereClause[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { headline: { [Op.iLike]: `%${search}%` } },
      { full_name: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (title) {
    whereClause.title = { [Op.iLike]: `%${title}%` };
  }

  if (seniority.length) {
    whereClause.seniority = { [Op.in]: seniority };
  }

  if (department) {
    whereClause[Op.and] = [
      ...(whereClause[Op.and] || []),
      {
        [Op.or]: [
          { departments: { [Op.overlap]: [department] } },
          { functions: { [Op.overlap]: [department] } },
        ],
      },
    ];
  }

  if (location) {
    whereClause[Op.and] = [
      ...(whereClause[Op.and] || []),
      {
        [Op.or]: [
          { city: { [Op.iLike]: `%${location}%` } },
          { state: { [Op.iLike]: `%${location}%` } },
          { country: { [Op.iLike]: `%${location}%` } },
        ],
      },
    ];
  }

  return whereClause;
};

export const searchCompanyPeople = async (request: Request, response: Response) => {
  try {
    const { companyId } = request.params;
    const company = await Companies.findByPk(companyId);

    if (!company) {
      sendResponse(response, 404, "Company not found");
      return;
    }

    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const offset = (page - 1) * limit;

    const filters: CompanyPeopleFilters = {
      search: String(request.query.search || "").trim(),
      title: String(request.query.title || "").trim(),
      seniority: parseSeniority(request.query.seniority),
      department: String(request.query.department || "").trim(),
      location: String(request.query.location || "").trim(),
    };

    const organizationExternalId: string | null = company.external_id;

    if (!organizationExternalId) {
      sendResponse(response, 200, "Company people fetched successfully", {
        people: [],
        total: 0,
        page,
        totalPages: 1,
      });
      return;
    }

    const whereClause = buildWhereClause(organizationExternalId, filters);

    const { count, rows } = await GeneralLeads.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    if (rows.length < limit) {
      try {
        const searchParams: Record<string, any> = {
          organization_ids: [organizationExternalId],
          per_page: 100,
          page: 1,
          ...(filters.title ? { person_titles: [filters.title] } : {}),
          ...(filters.seniority.length
            ? { person_seniorities: filters.seniority }
            : {}),
          ...(filters.location ? { person_locations: [filters.location] } : {}),
          ...(filters.search ? { q_keywords: filters.search } : {}),
        };

        const apolloResponse = await apolloService.request(
          "mixed_people/api_search",
          searchParams
        );

        const foundIds: string[] = Array.isArray(apolloResponse?.data?.people)
          ? apolloResponse.data.people
              .map((person: any) => person?.id)
              .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
          : [];

        if (foundIds.length) {
          const existingLeads = await GeneralLeads.findAll({
            where: { external_id: { [Op.in]: foundIds } },
            attributes: ["external_id"],
            raw: true,
          });
          const existingIds = new Set(
            existingLeads.map((lead: any) => lead.external_id)
          );
          const newIds = foundIds
            .filter((id) => !existingIds.has(id))
            .slice(0, limit);

          if (newIds.length) {
            const enrichedPeople = await apolloEnrichedPeople(newIds);
            if (enrichedPeople.length) {
              await persistApolloResults(enrichedPeople);
            }
          }
        }

        const refreshed = await GeneralLeads.findAndCountAll({
          where: whereClause,
          limit,
          offset,
          order: [["createdAt", "DESC"]],
        });

        sendResponse(response, 200, "Company people fetched successfully", {
          people: refreshed.rows,
          total: refreshed.count,
          page,
          totalPages: Math.max(1, Math.ceil(refreshed.count / limit)),
          source: "apollo",
        });
        return;
      } catch (apolloError: any) {
        logger.error(
          apolloError,
          "Error fetching people from Apollo for company search"
        );
      }
    }

    sendResponse(response, 200, "Company people fetched successfully", {
      people: rows,
      total: count,
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    });
  } catch (error: any) {
    logger.error(error, "Error fetching company people");
    sendResponse(response, 500, "Internal server error", null, error.message);
  }
};
