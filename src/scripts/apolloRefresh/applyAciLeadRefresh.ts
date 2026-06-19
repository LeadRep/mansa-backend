import dotenv from "dotenv";
import { Op } from "sequelize";
import logger from "../../logger";
import { database } from "../../configs/database/database";
import { ACILeads } from "../../models/ACILeads";
import {
  ApolloPeopleSnapshot,
  ApolloPeopleSnapshotStatuses,
} from "../../models/ApolloPeopleSnapshot";
import {
  getBooleanArg,
  getNumberArg,
  getStringArg,
  normalizeForDiff,
  parseCliArgs,
} from "./utils";

dotenv.config();

const apolloFieldMap: Array<[string, string]> = [
  ["first_name", "first_name"],
  ["last_name", "last_name"],
  ["full_name", "full_name"],
  ["name", "name"],
  ["linkedin_url", "linkedin_url"],
  ["title", "title"],
  ["photo_url", "photo_url"],
  ["twitter_url", "twitter_url"],
  ["github_url", "github_url"],
  ["facebook_url", "facebook_url"],
  ["headline", "headline"],
  ["email_status", "email_status"],
  ["extrapolated_email_confidence", "extrapolated_email_confidence"],
  ["email", "email"],
  ["phone", "phone"],
  ["organization_id", "organization_id"],
  ["employment_history", "employment_history"],
  ["departments", "departments"],
  ["subdepartments", "subdepartments"],
  ["seniority", "seniority"],
  ["functions", "functions"],
  ["state", "state"],
  ["city", "city"],
  ["country", "country"],
  ["street_address", "street_address"],
  ["postal_code", "postal_code"],
  ["formatted_address", "formatted_address"],
  ["time_zone", "time_zone"],
  ["email_domain_catchall", "email_domain_catchall"],
  ["revealed_for_current_team", "revealed_for_current_team"],
];

const main = async () => {
  const args = parseCliArgs(process.argv.slice(2));
  const runId = getStringArg(args, "runId", "");
  const dryRun = getBooleanArg(args, "dryRun", false);
  const limit = getNumberArg(args, "limit", 500);

  const where: Record<string, any> = {
    fetch_status: {
      [Op.in]: [
        ApolloPeopleSnapshotStatuses.SUCCESS,
        ApolloPeopleSnapshotStatuses.NOT_FOUND,
      ],
    },
  };

  if (runId) {
    where.run_id = runId;
  }

  const snapshots = await ApolloPeopleSnapshot.findAll({
    where,
    order: [["fetched_at", "DESC"]],
    limit,
  });

  if (!snapshots.length) {
    logger.info({ runId: runId || null }, "No snapshots available to apply");
    return;
  }

  let leadsMissing = 0;
  let leadsUpdated = 0;
  let noOpHash = 0;
  let dryRunUpdates = 0;
  let notFoundMarked = 0;

  for (const snapshot of snapshots) {
    const lead = await ACILeads.findOne({
      where: {
        external_id: snapshot.external_id,
      },
    });

    if (!lead) {
      leadsMissing += 1;
      continue;
    }

    const lastRefreshedAt = (lead as any).apollo_last_refreshed_at as Date | null;
    if (lastRefreshedAt && lastRefreshedAt >= snapshot.fetched_at) {
      continue;
    }

    if (snapshot.fetch_status === ApolloPeopleSnapshotStatuses.NOT_FOUND) {
      if (!dryRun) {
        await lead.update({
          apollo_last_refreshed_at: new Date(),
          apollo_refresh_status: ApolloPeopleSnapshotStatuses.NOT_FOUND,
          apollo_refresh_error: null,
        });
      }
      notFoundMarked += 1;
      continue;
    }

    const payload = snapshot.payload_json as any;
    if (!payload || typeof payload !== "object") {
      continue;
    }

    if (
      snapshot.payload_hash &&
      lead.apollo_last_payload_hash &&
      snapshot.payload_hash === lead.apollo_last_payload_hash
    ) {
      if (!dryRun) {
        await lead.update({
          apollo_last_refreshed_at: new Date(),
          apollo_refresh_status: ApolloPeopleSnapshotStatuses.SUCCESS,
          apollo_refresh_error: null,
        });
      }
      noOpHash += 1;
      continue;
    }

    const patch: Record<string, any> = {};
    const changedFields: string[] = [];

    for (const [leadField, apolloField] of apolloFieldMap) {
      const oldValue = normalizeForDiff((lead as any)[leadField]);
      const nextValue = normalizeForDiff(payload[apolloField]);

      if (JSON.stringify(oldValue) !== JSON.stringify(nextValue)) {
        patch[leadField] = payload[apolloField] ?? null;
        changedFields.push(leadField);
      }
    }

    patch.apollo_last_refreshed_at = new Date();
    patch.apollo_last_payload_hash = snapshot.payload_hash;
    patch.apollo_refresh_status = ApolloPeopleSnapshotStatuses.SUCCESS;
    patch.apollo_refresh_error = null;

    if (dryRun) {
      if (changedFields.length > 0) {
        dryRunUpdates += 1;
      }
      continue;
    }

    await lead.update(patch);

    if (changedFields.length > 0) {
      leadsUpdated += 1;
    }
  }

  logger.info(
    {
      runId: runId || null,
      dryRun,
      totalSnapshots: snapshots.length,
      leadsMissing,
      leadsUpdated,
      noOpHash,
      notFoundMarked,
      dryRunUpdates,
    },
    "Apollo refresh apply run completed"
  );
};

main()
  .catch((error: any) => {
    logger.error(error, "Failed applying Apollo snapshots to ACI leads");
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await database.close();
    } catch (error) {
      logger.error(error, "Failed to close database connection");
    }
  });
