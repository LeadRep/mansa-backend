import dotenv from "dotenv";
import { Op } from "sequelize";
import logger from "../../logger";
import { database } from "../../configs/database/database";
import { apolloService } from "../../utils/http/services/apolloService";
import {
  ApolloPeopleRefreshJob,
  ApolloPeopleRefreshJobStatuses,
} from "../../models/ApolloPeopleRefreshJob";
import {
  ApolloPeopleSnapshot,
  ApolloPeopleSnapshotStatuses,
} from "../../models/ApolloPeopleSnapshot";
import {
  chunkArray,
  getNumberArg,
  getStringArg,
  stableHash,
  parseCliArgs,
} from "./utils";

dotenv.config();

const shouldRetry = (statusCode: number | undefined): boolean => {
  if (!statusCode) {
    return true;
  }
  if (statusCode === 429) {
    return true;
  }
  return statusCode >= 500;
};

const computeNextRetryAt = (attempts: number): Date => {
  const delaySeconds = Math.min(300, Math.pow(2, Math.max(1, attempts)));
  const next = new Date();
  next.setSeconds(next.getSeconds() + delaySeconds);
  return next;
};

const main = async () => {
  const args = parseCliArgs(process.argv.slice(2));
  const runId = getStringArg(args, "runId", "");
  const limit = getNumberArg(args, "limit", 200);
  const batchSize = Math.min(10, Math.max(1, getNumberArg(args, "batchSize", 10)));
  const maxAttempts = Math.max(1, getNumberArg(args, "maxAttempts", 3));

  const baseWhere: Record<string, any> = {
    attempts: {
      [Op.lt]: maxAttempts,
    },
    [Op.or]: [
      {
        status: ApolloPeopleRefreshJobStatuses.PENDING,
      },
      {
        status: ApolloPeopleRefreshJobStatuses.FAILED,
        next_retry_at: {
          [Op.lte]: new Date(),
        },
      },
    ],
  };

  if (runId) {
    baseWhere.run_id = runId;
  }

  const candidates = await ApolloPeopleRefreshJob.findAll({
    where: baseWhere,
    order: [
      ["attempts", "ASC"],
      ["createdAt", "ASC"],
    ],
    limit,
  });

  if (!candidates.length) {
    logger.info({ runId: runId || null }, "No refresh jobs to process");
    return;
  }

  const claimedJobs: ApolloPeopleRefreshJob[] = [];
  for (const job of candidates) {
    const [updatedCount] = await ApolloPeopleRefreshJob.update(
      {
        status: ApolloPeopleRefreshJobStatuses.RUNNING,
        started_at: new Date(),
        finished_at: null,
        next_retry_at: null,
        error: null,
      },
      {
        where: {
          id: job.id,
          status: {
            [Op.in]: [
              ApolloPeopleRefreshJobStatuses.PENDING,
              ApolloPeopleRefreshJobStatuses.FAILED,
            ],
          },
        },
      }
    );

    if (updatedCount > 0) {
      claimedJobs.push(job);
    }
  }

  if (!claimedJobs.length) {
    logger.info("No jobs could be claimed");
    return;
  }

  let successCount = 0;
  let notFoundCount = 0;
  let failedCount = 0;
  let retriedCount = 0;

  const chunks = chunkArray(claimedJobs, batchSize);
  for (const chunk of chunks) {
    const details = chunk.map((job) => ({ id: job.external_id }));
    const payload: Record<string, unknown> = {
      details,
    };

    if (
      process.env.APOLLO_REVEAL_PHONE_NUMBER &&
      process.env.APOLLO_REVEAL_PHONE_NUMBER.toLowerCase() === "true"
    ) {
      payload.reveal_phone_number = true;
    }

    try {
      const response = await apolloService.request("people/bulk_match", payload);
      const matches: any[] = response?.data?.matches ?? [];
      const byExternalId = new Map<string, any>();

      for (const match of matches) {
        const externalId = match?.id ?? match?.person_id;
        if (typeof externalId === "string" && externalId.length > 0) {
          byExternalId.set(externalId, match);
        }
      }

      for (const job of chunk) {
        const match = byExternalId.get(job.external_id);
        if (match) {
          await ApolloPeopleSnapshot.upsert(
            {
              run_id: job.run_id,
              external_id: job.external_id,
              fetched_at: new Date(),
              fetch_status: ApolloPeopleSnapshotStatuses.SUCCESS,
              payload_json: match,
              payload_hash: stableHash(match),
              error: null,
            },
            { conflictFields: ["run_id", "external_id"] }
          );

          await ApolloPeopleRefreshJob.update(
            {
              status: ApolloPeopleRefreshJobStatuses.SUCCESS,
              finished_at: new Date(),
              error: null,
            },
            {
              where: {
                id: job.id,
              },
            }
          );
          successCount += 1;
        } else {
          await ApolloPeopleSnapshot.upsert(
            {
              run_id: job.run_id,
              external_id: job.external_id,
              fetched_at: new Date(),
              fetch_status: ApolloPeopleSnapshotStatuses.NOT_FOUND,
              payload_json: null,
              payload_hash: null,
              error: null,
            },
            { conflictFields: ["run_id", "external_id"] }
          );

          await ApolloPeopleRefreshJob.update(
            {
              status: ApolloPeopleRefreshJobStatuses.NOT_FOUND,
              finished_at: new Date(),
              error: null,
            },
            {
              where: {
                id: job.id,
              },
            }
          );
          notFoundCount += 1;
        }
      }
    } catch (error: any) {
      const statusCode = error?.status ?? error?.response?.status;
      const message =
        error?.response?.data?.error ?? error?.response?.data?.message ?? error?.message ?? "Apollo bulk_match failed";

      for (const job of chunk) {
        const attempts = (job.attempts ?? 0) + 1;
        const retryable = shouldRetry(statusCode) && attempts < maxAttempts;

        await ApolloPeopleSnapshot.upsert(
          {
            run_id: job.run_id,
            external_id: job.external_id,
            fetched_at: new Date(),
            fetch_status: ApolloPeopleSnapshotStatuses.FAILED,
            payload_json: null,
            payload_hash: null,
            error: message,
          },
          { conflictFields: ["run_id", "external_id"] }
        );

        await ApolloPeopleRefreshJob.update(
          {
            status: ApolloPeopleRefreshJobStatuses.FAILED,
            attempts,
            error: message,
            next_retry_at: retryable ? computeNextRetryAt(attempts) : null,
            finished_at: retryable ? null : new Date(),
          },
          {
            where: {
              id: job.id,
            },
          }
        );

        failedCount += 1;
        if (retryable) {
          retriedCount += 1;
        }
      }

      logger.error(
        {
          statusCode,
          message,
          chunkSize: chunk.length,
        },
        "Apollo refresh batch failed"
      );
    }
  }

  logger.info(
    {
      runId: runId || null,
      claimed: claimedJobs.length,
      successCount,
      notFoundCount,
      failedCount,
      retriedCount,
    },
    "Apollo refresh fetch run completed"
  );
};

main()
  .catch((error: any) => {
    logger.error(error, "Failed processing Apollo refresh fetch jobs");
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await database.close();
    } catch (error) {
      logger.error(error, "Failed to close database connection");
    }
  });
