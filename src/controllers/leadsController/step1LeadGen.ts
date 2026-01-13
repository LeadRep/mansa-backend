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
    
  } catch (error: any) {

  }
};
