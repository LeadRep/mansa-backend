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
      if (interation <= organizationPages) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } while (interation <= organizationPages);
    console.log("Total organizations found:", organizationIds.length);
    console.log("Total people found:", peopleIds.length);
    const leads = [];
    const BATCH_SIZE = 5;
    const REQUESTS_PER_MINUTE = 120;
    const DELAY = (30 * 1000) / REQUESTS_PER_MINUTE; // Delay between batches

    let processed = 0;
    const startTime = Date.now();
    for (let i = 0; i < peopleIds.length; i += BATCH_SIZE) {
      const batchIds = peopleIds.slice(i, i + BATCH_SIZE);
      const batchDetails = batchIds.map((id) => ({ id }));
      try {
        const enrichedBatch = await enrichPeople({ details: batchDetails }, 1);
        leads.push(...enrichedBatch.matches);
        const evaluatedLeads = await evaluateLeadsWithAI(
          customerPref,
          enrichedBatch.matches,
          userId
        );
        processed += batchDetails.length;

        // Progress logging
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        console.log(
          `Processed ${processed}/${peopleIds.length} (${Math.round(
            processed / elapsedMinutes
          )}/min) - ${Math.round(
            (processed / peopleIds.length) * 100
          )}% complete`
        );

        // Rate limiting delay
        if (i + BATCH_SIZE < peopleIds.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY));
        }
      } catch (error: any) {
        console.error(
          `Skipping batch ${i}-${i + BATCH_SIZE} due to error:`,
          error.message
        );
        continue;
      }
    }

    return;
  } catch (error: any) {
    console.log("Error while generating leads for", userId, error.message);
  }
};
