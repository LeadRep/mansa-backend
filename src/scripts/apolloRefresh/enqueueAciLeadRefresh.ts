import dotenv from "dotenv";
import crypto from "crypto";
import { Op } from "sequelize";
import logger from "../../logger";
import { database } from "../../configs/database/database";
import { ACILeads } from "../../models/ACILeads";
import {
  ApolloPeopleRefreshJob,
  ApolloPeopleRefreshJobStatuses,
} from "../../models/ApolloPeopleRefreshJob";
import {
  getNumberArg,
  getStringArg,
  parseCliArgs,
  parseCsvArg,
  uniqueStrings,
} from "./utils";

dotenv.config();

const main = async () => {
  const args = parseCliArgs(process.argv.slice(2));
  const runId = getStringArg(args, "runId", "") || crypto.randomUUID();
  const requestedBy = getStringArg(args, "requestedBy", "cli");
  const staleDays = getNumberArg(args, "staleDays", 30);
  const limit = getNumberArg(args, "limit", 5000);

  const externalIdsArg = getStringArg(args, "externalIds", "");

  let externalIds: string[] = [];

  if (externalIdsArg) {
    externalIds = uniqueStrings(parseCsvArg(externalIdsArg));
  } else {
    const staleSince = new Date();
    staleSince.setDate(staleSince.getDate() - staleDays);

    const leads = await ACILeads.findAll({
      attributes: ["external_id"],
      where: {
        external_id: {
          [Op.ne]: null,
        },
        [Op.or]: [
          { apollo_last_refreshed_at: null },
          {
            apollo_last_refreshed_at: {
              [Op.lt]: staleSince,
            },
          },
        ],
      },
      limit,
      order: [["apollo_last_refreshed_at", "ASC"]],
    });

    externalIds = uniqueStrings(
      leads
        .map((lead) => lead.external_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );
  }

  if (!externalIds.length) {
    logger.info("No leads found to enqueue");
    return;
  }

  const rows = externalIds.map((externalId) => ({
    run_id: runId,
    external_id: externalId,
    status: ApolloPeopleRefreshJobStatuses.PENDING,
    attempts: 0,
    next_retry_at: null,
    requested_by: requestedBy,
    error: null,
    started_at: null,
    finished_at: null,
  }));

  await ApolloPeopleRefreshJob.bulkCreate(rows, {
    ignoreDuplicates: true,
  });

  const queuedCount = await ApolloPeopleRefreshJob.count({
    where: {
      run_id: runId,
    },
  });

  logger.info(
    {
      runId,
      requestedBy,
      requestedCount: externalIds.length,
      queuedCount,
    },
    "Apollo ACI lead refresh jobs enqueued"
  );
};

main()
  .catch((error: any) => {
    logger.error(error, "Failed to enqueue Apollo refresh jobs");
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await database.close();
    } catch (error) {
      logger.error(error, "Failed to close database connection");
    }
  });
