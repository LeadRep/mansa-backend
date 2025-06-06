import { CustomerPref } from "../../models/CustomerPref";
import { organizationSearch } from "../../utils/services/apollo/organizationSearch";
import { orgSearchQueryPrompt } from "../../utils/services/ai/orgSearchQueryPrompt";
import { peopleSearch } from "../../utils/services/apollo/peopleSearch";
import { peopleSearchQueryPrompt } from "../../utils/services/ai/peopleSearchQueryPrompt";
import { enrichPeople } from "../../utils/services/apollo/enrichPeople";
import { evaluateLeadsWithAI } from "../../utils/services/ai/evaluateLeadsQuery";

const getCustomerPrefByUserId = async (userId: string) => {
  const pref = await CustomerPref.findOne({ where: { userId } });
  if (!pref) throw new Error("Customer preferences not found");
  return pref;
};

export const findLeads = async (userId: string) => {
  try {
    //get customer preferences by userId
    const customerPref = await getCustomerPrefByUserId(userId);
    //get organization search query from AI
    const orgSearchQuery = await orgSearchQueryPrompt(customerPref);
    const peopleSearchQuery = await peopleSearchQueryPrompt(customerPref);
    let organizationIds: string[] = [];
    let peopleIds: string[] = [];
    let organizationPages = 0;
    let interation = 1;
    do {
      const organizations = await organizationSearch(
        orgSearchQuery,
        interation
      );
      if (interation === 1)
        organizationPages = organizations.pagination.total_pages;
      organizationIds = [...organizationIds, ...organizations.model_ids];
      const people = await peopleSearch(
        { ...peopleSearchQuery, organization_ids: organizations.model_ids },
        1
      );
      peopleIds = [...peopleIds, ...people.model_ids];
      interation++;
    } while (interation <= organizationPages);
    console.log("Total organizations found:", organizationIds.length);
    console.log("Total people found:", peopleIds.length);
    const leads = [];
    for (let i = 0; i < peopleIds.length; i += 10) {
      const batchIds = peopleIds.slice(i, i + 10);
      const batchDetails = batchIds.map((id) => ({ id }));
      const enrichedBatch = await enrichPeople({ details: batchDetails });
      leads.push(...enrichedBatch.matches);
    }
    const evaluatedLeads = await evaluateLeadsWithAI(
      customerPref,
      leads,
      userId
    );
    return;
  } catch (error: any) {
    console.log("Error while generating leads for", userId, error.message);
  }
};
