import { CustomerPref } from "../../models/CustomerPref";
import { aiPeopleSearchQuery } from "../leadsController/aiPeopleSearchQuery";

export const getSearchParams = async (customerPref: CustomerPref) => {
  let aiQueryParams = customerPref.aiQueryParams;
  if (!aiQueryParams) {
    aiQueryParams = await aiPeopleSearchQuery(customerPref);
    await customerPref.update({ aiQueryParams });
  }
  return aiQueryParams;
};
