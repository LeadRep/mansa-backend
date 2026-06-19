import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export const ApolloPeopleRefreshJobStatuses = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  NOT_FOUND: "not_found",
} as const;

export type ApolloPeopleRefreshJobStatus =
  (typeof ApolloPeopleRefreshJobStatuses)[keyof typeof ApolloPeopleRefreshJobStatuses];

export interface ApolloPeopleRefreshJobAttributes {
  id: string;
  run_id: string;
  external_id: string;
  status: ApolloPeopleRefreshJobStatus;
  attempts: number;
  next_retry_at: Date | null;
  requested_by: string | null;
  error: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ApolloPeopleRefreshJobCreationAttributes = Optional<
  ApolloPeopleRefreshJobAttributes,
  | "id"
  | "status"
  | "attempts"
  | "next_retry_at"
  | "requested_by"
  | "error"
  | "started_at"
  | "finished_at"
  | "createdAt"
  | "updatedAt"
>;

export class ApolloPeopleRefreshJob extends Model<
  ApolloPeopleRefreshJobAttributes,
  ApolloPeopleRefreshJobCreationAttributes
> {
  [x: string]: any;
}

ApolloPeopleRefreshJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    run_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    external_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ApolloPeopleRefreshJobStatuses.PENDING,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    next_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    requested_by: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize: database,
    modelName: "apollo_people_refresh_jobs",
    timestamps: true,
  }
);
