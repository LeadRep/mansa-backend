// import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
// import { Leads } from "../../models/Leads";
// import { apolloOrganizationSearch } from "./apolloOrganizationSearch";
// import { aiOrganizationSearchQuery } from "./aiOrganizationSearchQuery";
// import { aiPeopleSearchQuery } from "./aiPeopleSearchQuery";
// import { apolloPeopleSearch } from "./apolloPeopleSearch";
// import { aiEvaluatedLeads } from "./aiEvaluatedLeads";
// import { apolloEnrichedPeople } from "./apolloEnrichedPeople";

// export const findLeads = async (userId: string, totalLeads: number) => {
//   try {
//     const customerPref = await CustomerPref.findOne({ where: { userId } });
//     if (!customerPref) {
//       console.error("Customer preferences not found for user:", userId);
//       return null;
//     }
//     let leads: any[] = [];
//     let attempts = 0;
//     const maxAttempts = 3; // Maximum attempts to find unique leads

//     while (leads.length < totalLeads && attempts < maxAttempts) {
//       // Step 1: Find relevant organizations
//       const orgSearchQuery = await orgSearchQueryPrompt(customerPref);
//       const organizations = await organizationSearch(orgSearchQuery);
//       if (organizations === false) {
//         return;
//       }

//       // Step 2: Find people from these organizations
//       const peopleSearchQuery = await peopleSearchQueryPrompt(customerPref);
//       let peopleIds: string[] = [];
//       let peopleSearchPage = 1;
//       let totalPeopleSearchPage = 0;

//       while (peopleIds.length < totalLeads - leads.length) {
//         const people = await peopleSearch(
//           {
//             ...peopleSearchQuery,
//             organization_id: organizations.model_ids, // Filter by organization IDs
//           },
//           peopleSearchPage
//         );
//         if (people === false) {
//           return;
//         }
//         if (totalPeopleSearchPage === 0) {
//           totalPeopleSearchPage = people.pagination.total_pages;
//           peopleSearchPage = 1;
//         }

//         // Add new IDs, ensuring we don't exceed the required total
//         const newIds = people.model_ids.slice(
//           0,
//           totalLeads - leads.length - peopleIds.length
//         );
//         peopleIds = [...peopleIds, ...newIds];
//         peopleIds = Array.from(new Set(peopleIds)); // Remove duplicates

//         if (peopleSearchPage > totalPeopleSearchPage) break;
//         peopleSearchPage++;
//       }

//       console.log(
//         `Found ${peopleIds.length} potential leads from organizations`
//       );

//       // Step 3: Check database for existing leads
//       const existingLeads = await Leads.findAll({
//         where: {
//           owner_id: userId,
//         },
//         attributes: ["external_id"],
//       });

//       const existingLeadIds = existingLeads.map((lead) => lead.external_id);
//       const newLeadIds = peopleIds.filter(
//         (id) => !existingLeadIds.includes(id)
//       );

//       console.log(
//         `After deduplication, ${newLeadIds.length} new leads to process`
//       );

//       // Step 4: Enrich and evaluate new leads
//       if (newLeadIds.length > 0) {
//         for (let i = 0; i < newLeadIds.length; i += 10) {
//           const batchIds = newLeadIds.slice(i, i + 10);
//           const batchDetails = batchIds.map((id) => ({ id }));

//           try {
//             const enrichedBatch = await enrichPeople(
//               { details: batchDetails },
//               1
//             );
//             const evaluatedLeads = await evaluateLeadsWithAI(
//               customerPref,
//               enrichedBatch.matches,
//               userId
//             );
//             leads = [...leads, ...evaluatedLeads];

//             // Stop if we've reached the required number
//             if (leads.length >= totalLeads) {
//               leads = leads.slice(0, totalLeads);
//               break;
//             }
//           } catch (error: any) {
//             console.error(
//               `Error processing batch ${i / 10 + 1}:`,
//               error.message
//             );
//           }
//         }
//       }

//       attempts++;
//       if (leads.length < totalLeads) {
//         console.log(
//           `Attempt ${attempts}: Found ${leads.length}/${totalLeads} leads. Trying again...`
//         );
//       }
//     }

//     if (leads.length < totalLeads) {
//       console.warn(
//         `Only found ${leads.length} unique leads after ${maxAttempts} attempts`
//       );
//     }
//     await CustomerPref.update(
//       { leadsGenerationStatus: LeadsGenerationStatus.COMPLETED },
//       { where: { userId } }
//     );
//     return leads.slice(0, totalLeads);
//   } catch (error: any) {
//     console.error("Error in findLeads:", error.message);
//   }
// };
