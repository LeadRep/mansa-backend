import { randomUUID } from "crypto";
import logger from "../logger";
import Users from "../models/Users";
import {
  getCurrentUser,
  getLeadGenContext,
  LeadGenContext,
  runWithLeadGenContext,
} from "./requestContext";

// Logger bound to the active lead generation run (runId, user, trigger...).
// Falls back to the base logger when called outside of a run.
export const getLeadGenLogger = () => {
  const leadGen = getLeadGenContext();
  const user = getCurrentUser();
  return logger.child({
    scope: "leadgen",
    leadGenRunId: leadGen?.runId ?? null,
    leadGenVersion: leadGen?.version ?? null,
    leadGenTrigger: leadGen?.trigger ?? null,
    userId: user?.id ?? null,
    userFirstName: user?.firstName ?? null,
  });
};

export const withLeadGenContext = async <T>(
  userId: string,
  params: Omit<LeadGenContext, "runId">,
  fn: () => Promise<T>
): Promise<T> => {
  let firstName: string | undefined;
  try {
    const user = await Users.findByPk(userId, { attributes: ["firstName"] });
    firstName = user?.firstName ?? undefined;
  } catch {
    // logging context only; never block lead generation
  }
  return runWithLeadGenContext(
    { ...params, runId: randomUUID() },
    { id: userId, firstName },
    fn
  );
};
