import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export interface PublicChatSessionAttributes {
  id: string;
  botConfigId?: string | null;
  visitorId: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  visitorCompany?: string | null;
  visitorPhone?: string | null;
  pageUrl?: string | null;
  referrer?: string | null;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

type PublicChatSessionCreationAttributes = Optional<
  PublicChatSessionAttributes,
  | "id"
  | "botConfigId"
  | "visitorName"
  | "visitorEmail"
  | "visitorCompany"
  | "visitorPhone"
  | "pageUrl"
  | "referrer"
  | "metadata"
>;

export class PublicChatSession
  extends Model<
    PublicChatSessionAttributes,
    PublicChatSessionCreationAttributes
  >
  implements PublicChatSessionAttributes
{
  public id!: string;
  public botConfigId!: string | null;
  public visitorId!: string;
  public visitorName!: string | null;
  public visitorEmail!: string | null;
  public visitorCompany!: string | null;
  public visitorPhone!: string | null;
  public pageUrl!: string | null;
  public referrer!: string | null;
  public metadata!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PublicChatSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    botConfigId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    visitorId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    visitorName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    visitorEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    visitorCompany: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    visitorPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    referrer: {
      type: DataTypes.TEXT,
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
    modelName: "PublicChatSession",
    tableName: "PublicChatSessions",
    timestamps: true,
  }
);

export default PublicChatSession;
