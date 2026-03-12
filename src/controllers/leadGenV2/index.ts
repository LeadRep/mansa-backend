import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import { Leads, LeadStatus } from "../../models/Leads";
import { emitLeadUpdate, emitLeadExpansionPrompt } from "../../utils/socket";
import { apolloEnrichedPeople } from "../leadsController/apolloEnrichedPeople";
import { getSearchParams } from "./getSearchParams";
import { searchGeneralLeads } from "./searchGeneralLeads";
import { collectApolloLeads } from "./collectApolloLeads";
import { persistApolloResults } from "./persistApolloResults";
import { filterLowQualityLeads } from "./filterLowQualityLeads";
import { evaluateLeads } from "./evaluateLeads";
import { buildUserLeads } from "./buildUserLeads";
import { ApolloPerson } from "./types";
import { relaxSearchParams } from "./relaxSearchParams";
import Users from "../../models/Users";

const normalizeQueryParams = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeQueryParams);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeQueryParams((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
};

const areQueryParamsEqual = (
  currentParams: Record<string, any> | null | undefined,
  nextParams: Record<string, any> | null | undefined
) =>
  JSON.stringify(normalizeQueryParams(currentParams ?? {})) ===
  JSON.stringify(normalizeQueryParams(nextParams ?? {}));

export const leadGenV2 = async (
  userId: string,
  totalLeads: number,
  restart?: boolean,
  expand?: boolean
) => {
  try {
    const userLeads = await Leads.findAll({
      where: { owner_id: userId },
      attributes: ["external_id"],
    });

    const customerPref = await CustomerPref.findOne({ where: { userId } });
    if (!customerPref) {
      console.error("ICP/BP data not found", userId);
      //user socket to notify about missing ICP/BP data
      return null;
    }

    customerPref.leadsGenerationStatus = LeadsGenerationStatus.ONGOING;
    await customerPref.save();

    const user = await Users.findByPk(userId, {
      attributes: ["firstName", "lastName", "companyName", "subscriptionName"],
    });
    const senderProfile = {
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      companyName: user?.companyName || null,
    };

    let currentPage = customerPref.currentPage;
    if (currentPage < 1) {
      currentPage = 1;
    }
    let totalPages = customerPref.totalPages;

    if (restart) {
      customerPref.currentPage = 1;
      customerPref.totalPages = 0;
      await customerPref.save();
      customerPref.aiQueryParams = null;
      await customerPref.save();
      await Leads.update(
        { status: LeadStatus.VIEWED }, 
        { where: { owner_id: userId, status: LeadStatus.NEW } }
      );
      currentPage = 1;
    }

    const baseQueryParams = await getSearchParams(customerPref);

    const existingLeadIds = new Set(
      userLeads
        .map((existingLead) => existingLead.external_id)
        .filter((externalId): externalId is string => Boolean(externalId))
    );

    const collectedLeadIds = new Set<string>();
    const leadsToEvaluate: ApolloPerson[] = [];
    const evaluatedLeadIds = new Set<string>();

    let aiQueryParams = baseQueryParams;

    const collectWithQueryParams = async (
      queryParams: Record<string, any> | null | undefined
    ) => {
      const missingCount = totalLeads - leadsToEvaluate.length;
      if (missingCount <= 0) {
        return;
      }

      const excludeExternalIds = [...new Set([...existingLeadIds, ...collectedLeadIds])];
      const cached = await searchGeneralLeads(
        queryParams,
        excludeExternalIds,
        missingCount
      );

      for (const person of cached.people) {
        if (
          !person.id ||
          existingLeadIds.has(person.id) ||
          collectedLeadIds.has(person.id) ||
          evaluatedLeadIds.has(person.id)
        ) {
          continue;
        }
        if (leadsToEvaluate.length >= totalLeads) {
          break;
        }
        collectedLeadIds.add(person.id);
        evaluatedLeadIds.add(person.id);
        leadsToEvaluate.push(person);
      }

      if (leadsToEvaluate.length >= totalLeads) {
        return;
      }

      const apolloResult = await collectApolloLeads(
        queryParams,
        currentPage,
        totalPages,
        totalLeads,
        existingLeadIds,
        collectedLeadIds,
        customerPref
      );

      currentPage = apolloResult.currentPage;
      totalPages = apolloResult.totalPages;

      if (!apolloResult.apolloLeadIds.length) {
        return;
      }

      const enrichedLeads = await apolloEnrichedPeople(apolloResult.apolloLeadIds);
      await persistApolloResults(enrichedLeads);

      for (const lead of enrichedLeads) {
        if (!lead.id || existingLeadIds.has(lead.id) || evaluatedLeadIds.has(lead.id)) {
          continue;
        }
        if (leadsToEvaluate.length >= totalLeads) {
          break;
        }
        evaluatedLeadIds.add(lead.id);
        leadsToEvaluate.push(lead);
      }
    };

    if (expand) {
      let reachedRelaxBaseline = false;

      while (leadsToEvaluate.length < totalLeads) {
        const relaxedParams = relaxSearchParams(aiQueryParams);
        reachedRelaxBaseline = areQueryParamsEqual(aiQueryParams, relaxedParams);
        aiQueryParams = relaxedParams;

        customerPref.aiQueryParams = aiQueryParams;
        customerPref.currentPage = 1;
        customerPref.totalPages = 0;
        await customerPref.save();
        currentPage = 1;
        totalPages = 0;

        await collectWithQueryParams(aiQueryParams);

        if (reachedRelaxBaseline) {
          break;
        }
      }
    } else {
      await collectWithQueryParams(aiQueryParams);
    }

    customerPref.currentPage = currentPage;
    customerPref.totalPages = totalPages;
    customerPref.leadsGenerationStatus = LeadsGenerationStatus.COMPLETED;
    await customerPref.save();

    if (!leadsToEvaluate.length) {
      if (!expand) {
        customerPref.currentPage = 1;
        await customerPref.save();
        emitLeadExpansionPrompt(userId, {
          missingCount: totalLeads,
          foundCount: 0,
          totalLeads,
        });
      }
      return {
        leads: [],
        message: "No lead found, please update buyer persona",
        needsExpansion: !expand,
        missingCount: totalLeads,
      };
    }

    const filteredLeads = filterLowQualityLeads(leadsToEvaluate);

    if (!filteredLeads.length) {
      if (!expand) {
        customerPref.currentPage = 1;
        await customerPref.save();
        emitLeadExpansionPrompt(userId, {
          missingCount: totalLeads,
          foundCount: 0,
          totalLeads,
        });
      }
      return {
        leads: [],
        message: "No lead found, please update buyer persona",
        needsExpansion: !expand,
        missingCount: totalLeads,
      };
    }

    const evaluationResults = await evaluateLeads(
      customerPref,
      filteredLeads,
      senderProfile
    );

    const scoredLeads = buildUserLeads(
      userId,
      filteredLeads,
      evaluationResults,
      customerPref,
      senderProfile
    );

    if (!scoredLeads.length) {
      if (!expand) {
        customerPref.currentPage = 1;
        await customerPref.save();
        emitLeadExpansionPrompt(userId, {
          missingCount: totalLeads,
          foundCount: 0,
          totalLeads,
        });
      }
      return {
        leads: [],
        message: "No lead found, please update buyer persona",
        needsExpansion: !expand,
        missingCount: totalLeads,
      };
    }

    const maxAllowedLeads =
      user?.subscriptionName || customerPref.subscriptionName ? 20 : 10;
    const currentNewLeadsCount = await Leads.count({
      where: { owner_id: userId, status: LeadStatus.NEW },
    });
    const remainingSlots = Math.max(0, maxAllowedLeads - currentNewLeadsCount);
    const leadsToCreate = remainingSlots > 0 ? scoredLeads.slice(0, remainingSlots) : [];

    const createdLeads = await Leads.bulkCreate(leadsToCreate, {
      returning: true,
    });

    if (createdLeads?.length) {
      emitLeadUpdate(userId, {
        leadIds: createdLeads.map((lead) => lead.id),
      });
    }

    const needsExpansion =
      !expand && remainingSlots > 0 && createdLeads.length < totalLeads;
    if (needsExpansion) {
      customerPref.currentPage = 1;
      await customerPref.save();
      emitLeadExpansionPrompt(userId, {
        missingCount: totalLeads - createdLeads.length,
        foundCount: createdLeads.length,
        totalLeads,
      });
    }
    return {
      leads: createdLeads,
      message: createdLeads.length ? undefined : "No lead found, please update buyer persona",
      needsExpansion,
      missingCount: needsExpansion ? totalLeads - createdLeads.length : 0,
    };
  } catch (error: any) {
    if (error instanceof Error) {
      await CustomerPref.update(
        { leadsGenerationStatus: LeadsGenerationStatus.FAILED },
        { where: { userId } }
      );
    }
    console.error("leadGenV2 error", error.message);
    return null;
  }
};
