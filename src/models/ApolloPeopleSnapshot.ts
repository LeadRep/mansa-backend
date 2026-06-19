import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export const ApolloPeopleSnapshotStatuses = {
  SUCCESS: "success",
  NOT_FOUND: "not_found",
  FAILED: "failed",
} as const;

export type ApolloPeopleSnapshotStatus =
  (typeof ApolloPeopleSnapshotStatuses)[keyof typeof ApolloPeopleSnapshotStatuses];

export interface ApolloPeopleSnapshotAttributes {
  id: string;
  run_id: string;
  external_id: string;
  fetched_at: Date;
  fetch_status: ApolloPeopleSnapshotStatus;
  payload_json: JSON | null;
  payload_hash: string | null;
  error: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ApolloPeopleSnapshotCreationAttributes = Optional<
  ApolloPeopleSnapshotAttributes,
  | "id"
  | "fetched_at"
  | "fetch_status"
  | "payload_json"
  | "payload_hash"
  | "error"
  | "createdAt"
  | "updatedAt"
>;

export class ApolloPeopleSnapshot extends Model<
  ApolloPeopleSnapshotAttributes,
  ApolloPeopleSnapshotCreationAttributes
> {
  [x: string]: any;
}

ApolloPeopleSnapshot.init(
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
    fetched_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fetch_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ApolloPeopleSnapshotStatuses.SUCCESS,
    },
    payload_json: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    payload_hash: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize: database,
    modelName: "apollo_people_snapshots",
    timestamps: true,
  }
);
