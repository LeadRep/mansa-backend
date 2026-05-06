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
  logger.info(`generating leads (step2LeadGen) for user:${userId}`);
  try {
    const userLeads = await Leads.findAll({});
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
      console.error("Customer preferences not found for user:", userId);
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
      customerPref.currentPage = 1;
      customerPref.totalPages = 0;
      await customerPref.save();
      aiQueryParams = "";
      await Leads.destroy({ where: { owner_id: userId } });
      currentPage = 1;
    }
    if (!aiQueryParams) {
      aiQueryParams = await aiPeopleSearchQuery(customerPref);
      await customerPref.update({ aiQueryParams });
    }
    const leadsToEvaluate: any[] = [];
    const collectedLeadIds: string[] = [];
    const leadsFromBfsPool: any[] = [];

    const bfsAccounts = getBfsLikeAccounts();
    const organizationId = user?.organization_id;
    logger.info(`BFS-like accounts: ${bfsAccounts.size}`);
    logger.info(`organization ID: ${organizationId}`);

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

        logger.info(`BFS-like leads found: ${bfsLeads.length}`);
        logger.info(`BFS-like leads to evaluate: ${leadsToEvaluate.length}`);
        logger.info(`BFS-like leads from BFS pool: ${leadsFromBfsPool.length}`);
        logger.info(`BFS-like leads collected: ${collectedLeadIds.length}`);
      }
    } catch (error: any) {
      logger.error(`Error fetching BFS-like leads: ${error.message}`);
    }


    while (leadsToEvaluate.length < totalLeads && !reachedEndOfResults) {
      if (totalPages > 0 && currentPage > totalPages) {
        reachedEndOfResults = true;
        break;
      }

      const pageToFetch = currentPage;
      const searchParams = aiQueryParams;

      const apolloResponse = await apolloPeopleSearch(
        searchParams,
        pageToFetch
      );
      const { people = [], pagination } = apolloResponse || {};

      if (!totalPages && pagination?.total_pages) {
        totalPages = pagination.total_pages;
      }

      if (!Array.isArray(people) || people.length === 0) {
        reachedEndOfResults = true;
        currentPage = pageToFetch;
        break;
      }

      const pageProcessed = pagination?.page ?? pageToFetch;

      const existingLeadIds = new Set(
        userLeads
          .filter((existingLead) => existingLead.owner_id === userId)
          .map((existingLead) => existingLead.external_id)
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

      if (totalPages && pageProcessed >= totalPages) {
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
      return {
        leads: [],
        message: "No lead found, please update buyer persona",
      };
    }

    const enrichedLeads = await apolloEnrichedPeople(collectedLeadIds);

    logger.info(`enriched ${enrichedLeads.length} leads (step2LeadGen)`);
    const aiEvaluation = await aiEvaluatedLeads(
      customerPref,
      enrichedLeads,
      senderProfile
    );

    logger.info(`evaluated ${aiEvaluation.length} leads (step2LeadGen)`);

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
      return {
        leads: [],
        message: "No lead found, please update buyer persona",
      };
    }
    logger.info(`scored ${scoredLeads.length} leads (step2LeadGen)`);

    const createdLeads = await Leads.bulkCreate(scoredLeads, {
      returning: true,
    });
    logger.info(`added ${scoredLeads.length} leads to DB (step2LeadGen)`);

    if (createdLeads?.length) {
      emitLeadUpdate(userId, {
        leadIds: createdLeads.map((lead) => lead.id),
      });
    }
    if (leadsFromBfsPool.length) {
      logger.info(`adding ${leadsFromBfsPool.length} leads from BFS pool to DB (step2LeadGen)`);
      BfsLeadsOrganizations.bulkCreate(
        leadsFromBfsPool.map(
          (lead: any) => ({
            id: v4(),
            bfs_id: lead.bfs_id,
            organization_id: organizationId!,
            loaded_by: userId
          })
        )
      )
    }

    return createdLeads;
  } catch (error: any) {
    if (error instanceof Error) {
      await CustomerPref.update(
        { leadsGenerationStatus: LeadsGenerationStatus.FAILED },
        { where: { userId } }
      );
    }
    console.error("step2LeadGen error", error.message);
    return null;
  }
};
