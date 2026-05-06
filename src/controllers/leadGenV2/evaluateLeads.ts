import { aiEvaluatedLeads } from "../leadsController/aiEvaluatedLeads";
import { ApolloPerson } from "./types";
import { IntroMailSender } from "../leadsController/introMail";

export const evaluateLeads = async (
  customerPref: any,
  people: ApolloPerson[],
  sender?: IntroMailSender | null
) : Promise<any[]> => {
  const aiEvaluation = await aiEvaluatedLeads(customerPref, people, sender);
  return aiEvaluation;
};
