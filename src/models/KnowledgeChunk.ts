import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";
import KnowledgeSource from "./KnowledgeSource";

export interface KnowledgeChunkAttributes {
  id: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding?: number[] | null;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

type KnowledgeChunkCreationAttributes = Optional<
  KnowledgeChunkAttributes,
  "id" | "tokenCount" | "embedding" | "metadata"
>;

export class KnowledgeChunk
  extends Model<KnowledgeChunkAttributes, KnowledgeChunkCreationAttributes>
  implements KnowledgeChunkAttributes
{
  public id!: string;
  public sourceId!: string;
  public chunkIndex!: number;
  public content!: string;
  public tokenCount!: number;
  public embedding!: number[] | null;
  public metadata!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

KnowledgeChunk.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    sourceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "KnowledgeSources",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    chunkIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tokenCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    embedding: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    sequelize: database,
    modelName: "KnowledgeChunk",
    tableName: "KnowledgeChunks",
    timestamps: true,
  }
);

KnowledgeSource.hasMany(KnowledgeChunk, {
  foreignKey: "sourceId",
  as: "chunks",
  onDelete: "CASCADE",
});

KnowledgeChunk.belongsTo(KnowledgeSource, {
  foreignKey: "sourceId",
  as: "source",
});

export default KnowledgeChunk;
