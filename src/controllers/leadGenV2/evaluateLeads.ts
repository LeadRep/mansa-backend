import { aiEvaluatedLeads } from "../leadsController/aiEvaluatedLeads";
import { ApolloPerson } from "./types";
import { IntroMailSender } from "../leadsController/introMail";

export const evaluateLeads = async (
  customerPref: any,
  people: ApolloPerson[],
  sender?: IntroMailSender | null
) : Promise<any[]> => {
  const aiEvaluation = await aiEvaluatedLeads(customerPref, people, sender);
  let evaluationResults: any[] = [];

  if (Array.isArray(aiEvaluation)) {
    evaluationResults = aiEvaluation;
  } else if (aiEvaluation && typeof aiEvaluation === "object" && Array.isArray(aiEvaluation.leads)) {
    evaluationResults = aiEvaluation.leads;
  }

  if (!Array.isArray(evaluationResults)) {
    console.error("Invalid evaluation results structure:", aiEvaluation);
    return [];
  }

  return evaluationResults;
};
