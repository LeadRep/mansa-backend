import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import { Leads, LeadStatus } from "../../models/Leads";
import {
  emitLeadUpdate,
  emitLeadExpansionPrompt,
  emitLeadGenerationStatus,
} from "../../utils/socket";
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
import { getLeadGenLogger } from "../../utils/leadGenLogger";

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
  const log = getLeadGenLogger();
  const startedAt = Date.now();
  try {
    const userLeads = await Leads.findAll({
      where: { owner_id: userId },
      attributes: ["external_id"],
    });
    log.info(
      { totalLeads, restart: Boolean(restart), expand: Boolean(expand), existingLeads: userLeads.length },
      "leadGenV2 started"
    );

    const customerPref = await CustomerPref.findOne({ where: { userId } });
    if (!customerPref) {
      log.error("leadGenV2 aborted: ICP/BP data not found");
      emitLeadGenerationStatus(userId, {
        status: "failed",
        message: "Buyer profile not configured. Please set up your ICP/BP.",
      });
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
      customerPref.aiQueryParams = null;
      await customerPref.save();
      await Leads.update(
        { status: LeadStatus.VIEWED },
        { where: { owner_id: userId, status: LeadStatus.NEW } }
      );
      currentPage = 1;
    }

    const baseQueryParams = await getSearchParams(customerPref);
    log.info(
      { restart: Boolean(restart), currentPage, totalPages, queryParams: baseQueryParams },
      "leadGenV2 search parameters resolved"
    );

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
      log.info(
        { missingCount, totalLeads, queryParams },
        "Searching cached leads (GeneralLeads) before calling Apollo"
      );

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

      log.info(
        { cachedFound: cached.people.length, collectedSoFar: leadsToEvaluate.length, totalLeads },
        "Cached lead search done"
      );

      if (leadsToEvaluate.length >= totalLeads) {
        log.info("Enough leads from cache, Apollo search not needed");
        return;
      }

      log.info(
        { stillMissing: totalLeads - leadsToEvaluate.length, currentPage, totalPages, expand: Boolean(expand) },
        "Not enough cached leads, calling Apollo people search"
      );
      const apolloResult = await collectApolloLeads(
        queryParams,
        currentPage,
        totalPages,
        totalLeads,
        existingLeadIds,
        collectedLeadIds,
        // During expansion the query is relaxed, so its pagination must not
        // leak into the user's saved ICP pagination state.
        expand ? undefined : customerPref
      );

      currentPage = apolloResult.currentPage;
      totalPages = apolloResult.totalPages;

      if (!apolloResult.apolloLeadIds.length) {
        log.warn(
          { currentPage, totalPages },
          "Apollo search returned no new leads"
        );
        return;
      }

      log.info(
        { count: apolloResult.apolloLeadIds.length },
        "Enriching Apollo leads"
      );
      const enrichedLeads = await apolloEnrichedPeople(apolloResult.apolloLeadIds);
      log.info(
        { requested: apolloResult.apolloLeadIds.length, enriched: enrichedLeads.length },
        "Apollo enrichment done"
      );
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

    const finishWithNoLeads = async () => {
      const message = "No lead found, please update buyer persona";
      log.warn(
        { expand: Boolean(expand), durationMs: Date.now() - startedAt },
        "leadGenV2 finished with no leads"
      );
      if (!expand) {
        customerPref.currentPage = 1;
        await customerPref.save();
        emitLeadExpansionPrompt(userId, {
          missingCount: totalLeads,
          foundCount: 0,
          totalLeads,
        });
      }
      // Always notify completion so the frontend can drop the "generating"
      // state and surface the real outcome, even on the expand path.
      emitLeadGenerationStatus(userId, {
        status: "completed",
        message,
        foundCount: 0,
      });
      return {
        leads: [],
        message,
        needsExpansion: !expand,
        missingCount: totalLeads,
      };
    };

    if (expand) {
      let reachedRelaxBaseline = false;

      while (leadsToEvaluate.length < totalLeads) {
        const relaxedParams = relaxSearchParams(aiQueryParams);
        reachedRelaxBaseline = areQueryParamsEqual(aiQueryParams, relaxedParams);
        const removedFilters = Object.keys(aiQueryParams ?? {}).filter(
          (key) => !(key in relaxedParams)
        );
        log.info(
          {
            collected: leadsToEvaluate.length,
            totalLeads,
            removedFilters,
            reachedRelaxBaseline,
          },
          "Expansion: relaxing search parameters and re-triggering search"
        );
        aiQueryParams = relaxedParams;

        // Relaxation is transient: keep the broadened query in-memory only so
        // the user's saved ICP (aiQueryParams/currentPage/totalPages) is never
        // overwritten and stays intact for future non-expand runs.
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

    if (!expand) {
      customerPref.currentPage = currentPage;
      customerPref.totalPages = totalPages;
    }
    customerPref.leadsGenerationStatus = LeadsGenerationStatus.COMPLETED;
    await customerPref.save();

    if (!leadsToEvaluate.length) {
      return finishWithNoLeads();
    }

    const filteredLeads = filterLowQualityLeads(leadsToEvaluate);
    log.info(
      { before: leadsToEvaluate.length, after: filteredLeads.length },
      "Low quality lead filter applied"
    );

    if (!filteredLeads.length) {
      return finishWithNoLeads();
    }

    const evaluationResults = await evaluateLeads(
      customerPref,
      filteredLeads,
      senderProfile
    );

    log.info(
      { evaluated: evaluationResults.length, submitted: filteredLeads.length },
      "AI evaluation done"
    );

    const scoredLeads = buildUserLeads(
      userId,
      filteredLeads,
      evaluationResults,
      customerPref,
      senderProfile
    );

    if (!scoredLeads.length) {
      return finishWithNoLeads();
    }

    const hasSubscription = Boolean(user?.subscriptionName || customerPref.subscriptionName);
    const maxAllowedLeads = hasSubscription ? 20 : 10;
    const currentNewLeadsCount = await Leads.count({
      where: { owner_id: userId, status: LeadStatus.NEW },
    });
    const remainingSlots = Math.max(0, maxAllowedLeads - currentNewLeadsCount);
    const leadsToCreate = remainingSlots > 0 ? scoredLeads.slice(0, remainingSlots) : [];

    log.info(
      {
        scored: scoredLeads.length,
        maxAllowedLeads,
        currentNewLeadsCount,
        remainingSlots,
        toCreate: leadsToCreate.length,
      },
      "Applying new-lead quota"
    );

    const createdLeads = await Leads.bulkCreate(leadsToCreate, {
      returning: true,
    });
    log.info(
      { created: createdLeads.length, requested: totalLeads, durationMs: Date.now() - startedAt },
      "leadGenV2 leads created"
    );

    if (createdLeads?.length) {
      emitLeadUpdate(userId, {
        leadIds: createdLeads.map((lead) => lead.id),
      });
    }

    const needsExpansion =
      !expand && remainingSlots > 0 && createdLeads.length < totalLeads;
    if (needsExpansion) {
      log.info(
        { missingCount: totalLeads - createdLeads.length, foundCount: createdLeads.length },
        "Fewer leads than requested, prompting user for expansion"
      );
      customerPref.currentPage = 1;
      await customerPref.save();
      emitLeadExpansionPrompt(userId, {
        missingCount: totalLeads - createdLeads.length,
        foundCount: createdLeads.length,
        totalLeads,
      });
    }
    if (!createdLeads.length) {
      emitLeadGenerationStatus(userId, {
        status: "completed",
        message: "No lead found, please update buyer persona",
        foundCount: 0,
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
    emitLeadGenerationStatus(userId, {
      status: "failed",
      message: "Lead generation failed. Please try again.",
    });
    log.error(
      { err: error, durationMs: Date.now() - startedAt },
      "leadGenV2 failed"
    );
    return null;
  }
};
