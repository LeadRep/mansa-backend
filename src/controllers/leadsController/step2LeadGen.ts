import { Op } from "sequelize";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import { Leads, LeadStatus } from "../../models/Leads";
import { aiPeopleSearchQuery } from "./aiPeopleSearchQuery";
import { apolloPeopleSearch } from "./apolloPeopleSearch";
import { aiEvaluatedLeads } from "./aiEvaluatedLeads";
import { apolloEnrichedPeople } from "./apolloEnrichedPeople";
import { emitLeadUpdate } from "../../utils/socket";

export const step2LeadGen = async (
  userId: string,
  totalLeads: number,
  restart?: boolean
) => {
  try {
    const userLeads = await Leads.findAll({});
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

    const aiEvaluation = await aiEvaluatedLeads(customerPref, enrichedLeads);

    const evaluationResults = Array.isArray(aiEvaluation)
      ? aiEvaluation
      : Array.isArray(aiEvaluation?.leads)
      ? aiEvaluation.leads
      : [];

    const scoredLeads = enrichedLeads.reduce((acc: any[], lead: any) => {
      const aiScore = evaluationResults.find(
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

    const createdLeads = await Leads.bulkCreate(scoredLeads, {
      returning: true,
    });

    if (createdLeads?.length) {
      emitLeadUpdate(userId, {
        leadIds: createdLeads.map((lead) => lead.id),
      });
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
