import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import { Leads, LeadStatus } from "../../models/Leads";
import Users from "../../models/Users";
import { CustomerPref, LeadsGenerationStatus } from "../../models/CustomerPref";
import logger from "../../logger";
import { runLeadGeneration } from "../leadsController/leadGenSelector";

// Tracks users whose FAILED generation has already been auto-retried, so a
// persistently failing run is retried at most once per failure episode rather
// than on every page load. Cleared once the user leaves the FAILED state.
const failedRetryAttempted = new Set<string>();

export const userLeads = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const expand = String(req.query?.expand ?? "").toLowerCase() === "true";
    const user = await Users.findOne({ where: { id: userId } });
    const customer = await CustomerPref.findOne({ where: { userId } });

    if (!user) {
      sendResponse(res, 400, "User not found", []);
      return;
    }
    let userLeads = await Leads.findAll({
      where: { owner_id: userId, status: LeadStatus.NEW },
      order: [["createdAt", "DESC"]],
    });
    const hasSubscription = Boolean(
      user.subscriptionName || customer?.subscriptionName
    );
    const generationStatus = customer?.leadsGenerationStatus;
    const maxLeads = hasSubscription ? 20 : 10;

    if (userLeads.length > maxLeads) {
      userLeads = userLeads.slice(0, maxLeads);
    }

    const needsMoreLeads = userLeads.length < maxLeads;

    if (needsMoreLeads) {
      // Auto-generate only when a run is actually pending (NOT_STARTED — set by
      // onboarding / ICP update / refresh). A COMPLETED cycle must NOT be
      // restarted by routine page loads, otherwise declining the "not enough
      // leads" prompt has no effect: the next GET (including the prompt's own
      // validation fetch and the leads:new refetch) silently kicks generation
      // off again. An explicit expand request bypasses this.
      //
      // A FAILED run is retried automatically, but only once per failure
      // episode so a persistently failing generation can't hammer the
      // AI/Apollo APIs on every page load.
      const canRetryFailed =
        generationStatus === LeadsGenerationStatus.FAILED &&
        !failedRetryAttempted.has(userId);

      const shouldTriggerGeneration =
        generationStatus !== LeadsGenerationStatus.ONGOING &&
        (expand ||
          generationStatus === LeadsGenerationStatus.NOT_STARTED ||
          canRetryFailed);

      if (generationStatus !== LeadsGenerationStatus.FAILED) {
        // Out of the failed state — allow a fresh retry on the next failure.
        failedRetryAttempted.delete(userId);
      } else if (canRetryFailed) {
        failedRetryAttempted.add(userId);
      }

      const isGenerating =
        generationStatus === LeadsGenerationStatus.ONGOING ||
        shouldTriggerGeneration;

      const message = isGenerating
        ? "Currently generating leads, please wait a moment"
        : userLeads.length === 0
          ? "No lead found, please update buyer persona"
          : undefined;

      const responsePayload = {
        leads: userLeads,
        needsExpansion: false,
        missingCount: maxLeads - userLeads.length,
        message,
      };

      sendResponse(res, 200, message ?? "Leads gotten", responsePayload);

      if (shouldTriggerGeneration) {
        runLeadGeneration(userId, maxLeads - userLeads.length, false, expand);
      }
      return;
    }

    const responsePayload = {
      leads: userLeads.slice(0, maxLeads),
      needsExpansion: false,
      missingCount: 0,
    };
    sendResponse(res, 200, "Leads gotten", responsePayload);
    return;
  } catch (error: any) {
    console.log("UserLeads error", error.message)
    logger.error(error, "Error in userLeads:");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
