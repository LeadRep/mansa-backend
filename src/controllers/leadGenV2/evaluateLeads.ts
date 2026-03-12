import { aiEvaluatedLeads } from "../leadsController/aiEvaluatedLeads";
import { ApolloPerson } from "./types";
import { IntroMailSender } from "../leadsController/introMail";

export const evaluateLeads = async (
  customerPref: any,
  people: ApolloPerson[],
  sender?: IntroMailSender | null
) => {
  const aiEvaluation = await aiEvaluatedLeads(customerPref, people, sender);
  const evaluationResults = Array.isArray(aiEvaluation)
    ? aiEvaluation
    : Array.isArray(aiEvaluation?.leads)
    ? aiEvaluation.leads
    : [];

  return evaluationResults;
};
