import {CustomerPref, LeadsGenerationStatus} from "../../models/CustomerPref";
import {Leads, LeadStatus} from "../../models/Leads";
import {aiPeopleSearchQuery} from "./aiPeopleSearchQuery";
import {apolloPeopleSearch} from "./apolloPeopleSearch";
import {aiEvaluatedLeads} from "./aiEvaluatedLeads";
import {apolloEnrichedPeople} from "./apolloEnrichedPeople";
import {emitLeadUpdate} from "../../utils/socket";
import {normalizeIntroMail} from "./introMail";
import Users from "../../models/Users";
import logger from "../../logger";
import { getLeadGenLogger } from "../../utils/leadGenLogger";
import {getBfsLikeAccounts} from "../../utils/env";
import BfsLeads from "../../models/BfsLeads";
import {QueryTypes, Sequelize} from "sequelize";
import BfsLeadsOrganizations from "../../models/BfsLeadsOrganizations";
import {v4} from "uuid";

async function getLeadsNotSeenByOrgRaw(orgId: string, totalLeads: number) {
  const sql = `
    SELECT b.*
    FROM bfs_leads b
    LEFT JOIN bfs_leads_organizations o
      ON o.bfs_id = b.bfs_id AND o.organization_id = $orgId
    WHERE o.organization_id IS NULL AND b.external_id IS NOT NULL
        LIMIT $totalLeads
  `;
  const results = await (BfsLeads.sequelize as Sequelize).query(sql, {
    bind: { orgId, totalLeads },
    type: QueryTypes.SELECT,
    model: BfsLeads,
    mapToModel: true,
  });
  return Array.isArray(results) ? results : results ? [results] : [];
}

export const step2LeadGen = async (
  userId: string,
  totalLeads: number,
  restart?: boolean
) => {
  const log = getLeadGenLogger();
  const startedAt = Date.now();
  log.info({ totalLeads, restart: Boolean(restart) }, "step2LeadGen (v1) started");
  try {
    const userLeads = await Leads.findAll({
      where: { owner_id: userId },
      attributes: ["external_id"],
    });
    const user = await Users.findByPk(userId, {
      attributes: ["firstName", "lastName", "companyName", "organization_id"],
    });
    const senderProfile = {
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      companyName: user?.companyName || null,
    };
    const customerPref = await CustomerPref.findOne({ where: { userId } });
    if (!customerPref) {
      log.error("step2LeadGen aborted: customer preferences not found");
      return null;
    }
    customerPref.leadsGenerationStatus = LeadsGenerationStatus.ONGOING;
    await customerPref.save();

    let aiQueryParams = customerPref.aiQueryParams;
    let currentPage = customerPref.currentPage;
    if (currentPage < 1) {
      currentPage = 1;
    }
    let totalPages = customerPref.totalPages;
    let reachedEndOfResults = false;
    if (restart) {
      log.info({ existingLeads: userLeads.length }, "Restart requested: resetting pagination and deleting existing leads");
      customerPref.currentPage = 1;
      customerPref.totalPages = 0;
      await customerPref.save();
      aiQueryParams = "";
      await Leads.destroy({ where: { owner_id: userId } });
      currentPage = 1;
    }
    if (!aiQueryParams) {
      log.info("No saved AI query params, generating them");
      aiQueryParams = await aiPeopleSearchQuery(customerPref);
      await customerPref.update({ aiQueryParams });
    }
    log.info({ currentPage, totalPages, queryParams: aiQueryParams, existingLeads: userLeads.length }, "step2LeadGen search parameters resolved");
    const leadsToEvaluate: any[] = [];
    const collectedLeadIds: string[] = [];
    const leadsFromBfsPool: any[] = [];

    const bfsAccounts = getBfsLikeAccounts();
    const organizationId = user?.organization_id;
    log.info({ bfsAccounts: bfsAccounts.size, organizationId }, "Checking BFS pool eligibility");

    try {
      if (organizationId && bfsAccounts.has(organizationId)) {
        const bfsLeadsResult = await getLeadsNotSeenByOrgRaw(organizationId, totalLeads);

        // Convert model instances to plain objects safely
        const bfsLeads = Array.isArray(bfsLeadsResult)
          ? bfsLeadsResult.map((lead: any) => (lead && typeof lead.get === 'function' ? lead.get({ plain: true }) : lead))
          : [];

        if (bfsLeads.length) {
          const ids = bfsLeads.map((lead: any) => lead.external_id);
          leadsToEvaluate.push(...bfsLeads);
          leadsFromBfsPool.push(...bfsLeads);
          collectedLeadIds.push(...ids);
        }

        log.info(
          { found: bfsLeads.length, toEvaluate: leadsToEvaluate.length, totalLeads },
          "BFS pool leads collected"
        );
      }
    } catch (error: any) {
      log.error({ err: error }, "Error fetching BFS-like leads");
    }


    while (leadsToEvaluate.length < totalLeads && !reachedEndOfResults) {
      if (totalPages > 0 && currentPage > totalPages) {
        reachedEndOfResults = true;
        break;
      }

      const pageToFetch = currentPage;
      const searchParams = aiQueryParams;
      log.info(
        { page: pageToFetch, totalPages, collected: leadsToEvaluate.length, missing: totalLeads - leadsToEvaluate.length },
        "Not enough leads yet, calling Apollo people search"
      );

      const apolloResponse = await apolloPeopleSearch(
        searchParams,
        pageToFetch
      );
      const { people = [], pagination } = apolloResponse || {};

      if (!totalPages && pagination?.total_pages) {
        totalPages = pagination.total_pages;
      }

      if (!Array.isArray(people) || people.length === 0) {
        log.info({ page: pageToFetch }, "Apollo returned an empty page, end of results");
        reachedEndOfResults = true;
        currentPage = pageToFetch;
        break;
      }

      const pageProcessed = pagination?.page ?? pageToFetch;

      const existingLeadIds = new Set(
        userLeads.map((existingLead) => existingLead.external_id)
      );

      for (const lead of people) {
        if (leadsToEvaluate.length >= totalLeads) {
          break;
        }

        const alreadyHaveLead =
          existingLeadIds.has(lead.id) ||
          collectedLeadIds.includes(lead.id);

        if (!alreadyHaveLead) {
          collectedLeadIds.push(lead.id);
          leadsToEvaluate.push(lead);
        }
      }

      log.info(
        { page: pageProcessed, totalPages, returned: people.length, collected: leadsToEvaluate.length, target: totalLeads },
        "Apollo page processed"
      );

      if (totalPages && pageProcessed >= totalPages) {
        log.info("Reached last Apollo page");
        reachedEndOfResults = true;
        currentPage = totalPages;
        break;
      }

      currentPage = pageProcessed + 1;
    }
    customerPref.currentPage = currentPage;
    customerPref.totalPages = totalPages;
    customerPref.leadsGenerationStatus = LeadsGenerationStatus.COMPLETED;
    await customerPref.save();

    if (!leadsToEvaluate.length) {
      log.warn({ durationMs: Date.now() - startedAt }, "step2LeadGen finished with no leads");
      return {
        leads: [],
        message: "No lead found, please update buyer persona",
      };
    }

    const enrichedLeads = await apolloEnrichedPeople(collectedLeadIds);

    log.info({ requested: collectedLeadIds.length, enriched: enrichedLeads.length }, "Apollo enrichment done");
    const aiEvaluation = await aiEvaluatedLeads(
      customerPref,
      enrichedLeads,
      senderProfile
    );

    log.info({ submitted: enrichedLeads.length, evaluated: aiEvaluation.length }, "AI evaluation done");

    const scoredLeads = enrichedLeads.reduce((acc: any[], lead: any) => {
      const aiScore = aiEvaluation.find(
        (item: any) => item.id === lead.id
      );
      if (!aiScore) {
        return acc;
      }

      acc.push({
        external_id: lead.id,
        owner_id: userId,
        first_name: lead.first_name ?? null,
        last_name: lead.last_name ?? null,
        full_name: lead.name ?? lead.full_name ?? null,
        linkedin_url: lead.linkedin_url ?? null,
        title: lead.title ?? null,
        photo_url: lead.photo_url ?? null,
        twitter_url: lead.twitter_url ?? null,
        github_url: lead.github_url ?? null,
        facebook_url: lead.facebook_url ?? null,
        headline: lead.headline ?? null,
        email: lead.email ?? null,
        phone: lead.phone_numbers?.[0]?.number ?? null,
        organization: lead.organization ?? null,
        departments: lead.departments ?? null,
        state: lead.state ?? null,
        city: lead.city ?? null,
        country: lead.country ?? null,
        category: aiScore.category ?? null,
        reason: aiScore.reason ?? null,
        score: aiScore.score ?? null,
        intro_mail: normalizeIntroMail(
          aiScore.intro_mail,
          lead,
          customerPref,
          senderProfile
        ),
        status: LeadStatus.NEW,
        views: 1,
      });

      return acc;
    }, []);

    if (!scoredLeads.length) {
      log.warn({ durationMs: Date.now() - startedAt }, "step2LeadGen finished: no lead scored");
      return {
        leads: [],
        message: "No lead found, please update buyer persona",
      };
    }
    log.info({ scored: scoredLeads.length }, "Leads scored");

    const createdLeads = await Leads.bulkCreate(scoredLeads, {
      returning: true,
    });
    log.info({ created: createdLeads.length, requested: totalLeads, durationMs: Date.now() - startedAt }, "step2LeadGen leads created");

    if (createdLeads?.length) {
      emitLeadUpdate(userId, {
        leadIds: createdLeads.map((lead) => lead.id),
      });
    }
    if (leadsFromBfsPool.length) {
      log.info({ count: leadsFromBfsPool.length }, "Recording BFS pool leads as loaded for organization");
      try {
        await BfsLeadsOrganizations.bulkCreate(
          leadsFromBfsPool.map(
            (lead: any) => ({
              id: v4(),
              bfs_id: lead.bfs_id,
              organization_id: organizationId!,
              loaded_by: userId
            })
          )
        );
      } catch (error) {
        logger.error(
          {
            error,
            userId,
            organizationId,
            bfsLeadCount: leadsFromBfsPool.length,
          },
          "failed to persist BFS lead organization mappings (step2LeadGen)"
        );
        throw error;
      }
    }

    return createdLeads;
  } catch (error: any) {
    if (error instanceof Error) {
      await CustomerPref.update(
        { leadsGenerationStatus: LeadsGenerationStatus.FAILED },
        { where: { userId } }
      );
    }
    log.error({ err: error, durationMs: Date.now() - startedAt }, "step2LeadGen failed");
    return null;
  }
};
