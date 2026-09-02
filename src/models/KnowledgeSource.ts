import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export interface KnowledgeSourceAttributes {
  id: string;
  ownerType: "admin" | "user";
  ownerId?: string | null;
  title: string;
  type: "text" | "document" | "faq" | "url";
  content?: string | null;
  filePath?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  chunkCount: number;
  tokenCount: number;
  status: "processing" | "ready" | "error";
  errorMessage?: string | null;
  isActive: boolean;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

type KnowledgeSourceCreationAttributes = Optional<
  KnowledgeSourceAttributes,
  | "id"
  | "ownerType"
  | "ownerId"
  | "content"
  | "filePath"
  | "fileType"
  | "fileSize"
  | "chunkCount"
  | "tokenCount"
  | "status"
  | "errorMessage"
  | "isActive"
  | "metadata"
>;

export class KnowledgeSource
  extends Model<KnowledgeSourceAttributes, KnowledgeSourceCreationAttributes>
  implements KnowledgeSourceAttributes
{
  public id!: string;
  public ownerType!: "admin" | "user";
  public ownerId!: string | null;
  public title!: string;
  public type!: "text" | "document" | "faq" | "url";
  public content!: string | null;
  public filePath!: string | null;
  public fileType!: string | null;
  public fileSize!: number | null;
  public chunkCount!: number;
  public tokenCount!: number;
  public status!: "processing" | "ready" | "error";
  public errorMessage!: string | null;
  public isActive!: boolean;
  public metadata!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

KnowledgeSource.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    ownerType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "admin",
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("text", "document", "faq", "url"),
      allowNull: false,
      defaultValue: "text",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fileType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    chunkCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    tokenCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("processing", "ready", "error"),
      allowNull: false,
      defaultValue: "ready",
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    sequelize: database,
    modelName: "KnowledgeSource",
    tableName: "KnowledgeSources",
    timestamps: true,
  }
);

export default KnowledgeSource;
