import { apolloPeopleSearch } from "../leadsController/apolloPeopleSearch";
import { CustomerPref } from "../../models/CustomerPref";
import { ApolloPerson } from "./types";

const APOLLO_PER_PAGE = 100;

export const collectApolloLeads = async (
  aiQueryParams: Record<string, any> | null | undefined,
  currentPage: number,
  totalPages: number,
  targetCount: number,
  existingLeadIds: Set<string>,
  collectedLeadIds: Set<string>,
  customerPref?: CustomerPref
) => {
  const apolloLeads: ApolloPerson[] = [];
  const apolloLeadIds: string[] = [];
  let reachedEndOfResults = false;
  let page = currentPage < 1 ? 1 : currentPage;
  let maxPages = totalPages;
  let persistedTotalPages = false;

  while (collectedLeadIds.size < targetCount && !reachedEndOfResults) {
    if (maxPages > 0 && page > maxPages) {
      reachedEndOfResults = true;
      break;
    }

    const apolloResponse = await apolloPeopleSearch(aiQueryParams, page);
    const { people = [] } = apolloResponse || {};
    const perPage = APOLLO_PER_PAGE;
    const totalEntries = Number(apolloResponse?.total_entries) || 0;

    const pageProcessed = Number(apolloResponse?.page) || page;

    if (totalEntries > 0) {
      const computedTotalPages = Math.ceil(totalEntries / perPage);
      if (!maxPages || computedTotalPages > 0) {
        maxPages = computedTotalPages;
      }

      if (
        customerPref &&
        !persistedTotalPages &&
        pageProcessed === 1 &&
        customerPref.totalPages !== computedTotalPages
      ) {
        await customerPref.update({ totalPages: computedTotalPages });
        persistedTotalPages = true;
      }
    }

    if (!Array.isArray(people) || people.length === 0) {
      reachedEndOfResults = true;
      break;
    }

    for (const lead of people) {
      if (collectedLeadIds.size >= targetCount) {
        break;
      }
      if (!lead?.id) {
        continue;
      }
      const alreadyHaveLead =
        existingLeadIds.has(lead.id) || collectedLeadIds.has(lead.id);
      if (!alreadyHaveLead) {
        collectedLeadIds.add(lead.id);
        apolloLeadIds.push(lead.id);
        apolloLeads.push(lead);
      }
    }

    if (maxPages && pageProcessed >= maxPages) {
      reachedEndOfResults = true;
      page = maxPages;
      break;
    }

    page = pageProcessed + 1;
  }
  return { apolloLeads, apolloLeadIds, currentPage: page, totalPages: maxPages };
};
