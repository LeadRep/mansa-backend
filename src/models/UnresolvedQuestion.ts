import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export interface UnresolvedQuestionAttributes {
  id: string;
  ownerType: "admin" | "user";
  ownerId?: string | null;
  question: string;
  frequency: number;
  status: "pending" | "resolved" | "ignored";
  suggestedAnswer?: string | null;
  lastBotResponse?: string | null;
  similarityScore?: number | null;
  lastAskedAt: Date;
  resolvedSourceId?: string | null;
  visitorId?: string | null;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

type UnresolvedQuestionCreationAttributes = Optional<
  UnresolvedQuestionAttributes,
  | "id"
  | "ownerType"
  | "ownerId"
  | "frequency"
  | "status"
  | "suggestedAnswer"
  | "lastBotResponse"
  | "similarityScore"
  | "lastAskedAt"
  | "resolvedSourceId"
  | "visitorId"
  | "metadata"
>;

export class UnresolvedQuestion
  extends Model<
    UnresolvedQuestionAttributes,
    UnresolvedQuestionCreationAttributes
  >
  implements UnresolvedQuestionAttributes
{
  public id!: string;
  public ownerType!: "admin" | "user";
  public ownerId!: string | null;
  public question!: string;
  public frequency!: number;
  public status!: "pending" | "resolved" | "ignored";
  public suggestedAnswer!: string | null;
  public lastBotResponse!: string | null;
  public similarityScore!: number | null;
  public lastAskedAt!: Date;
  public resolvedSourceId!: string | null;
  public visitorId!: string | null;
  public metadata!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UnresolvedQuestion.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ownerType: {
      type: DataTypes.STRING(32),
      defaultValue: "admin",
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    frequency: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "resolved", "ignored"),
      defaultValue: "pending",
      allowNull: false,
    },
    suggestedAnswer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastBotResponse: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    similarityScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    lastAskedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    resolvedSourceId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    visitorId: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    sequelize: database,
    tableName: "UnresolvedQuestions",
    timestamps: true,
    indexes: [
      { fields: ["ownerType", "status"] },
      { fields: ["question"] },
      { fields: ["lastAskedAt"] },
    ],
  }
);
