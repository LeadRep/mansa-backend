import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export interface BotConfigAttributes {
  id: string;
  ownerType: "admin" | "user";
  ownerId?: string | null;
  botName: string;
  welcomeMessage: string;
  placeholderText: string;
  themeColor: string;
  avatarUrl?: string | null;
  suggestedQuestions: string[];
  leadCaptureEnabled: boolean;
  leadCaptureTitle: string;
  isActive: boolean;
  allowedDomains: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

type BotConfigCreationAttributes = Optional<
  BotConfigAttributes,
  | "id"
  | "ownerType"
  | "ownerId"
  | "botName"
  | "welcomeMessage"
  | "placeholderText"
  | "themeColor"
  | "avatarUrl"
  | "suggestedQuestions"
  | "leadCaptureEnabled"
  | "leadCaptureTitle"
  | "isActive"
  | "allowedDomains"
>;

export class BotConfig
  extends Model<BotConfigAttributes, BotConfigCreationAttributes>
  implements BotConfigAttributes
{
  public id!: string;
  public ownerType!: "admin" | "user";
  public ownerId!: string | null;
  public botName!: string;
  public welcomeMessage!: string;
  public placeholderText!: string;
  public themeColor!: string;
  public avatarUrl!: string | null;
  public suggestedQuestions!: string[];
  public leadCaptureEnabled!: boolean;
  public leadCaptureTitle!: string;
  public isActive!: boolean;
  public allowedDomains!: string[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BotConfig.init(
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
    botName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "LeadRep Assistant",
    },
    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue:
        "Hi there! 👋 How can I help you learn about LeadRep today? Ask anything about our lead intelligence, features, or pricing.",
    },
    placeholderText: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Ask anything about LeadRep...",
    },
    themeColor: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "#2563EB",
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    suggestedQuestions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [
        "What is LeadRep?",
        "How does lead discovery work?",
        "What pricing plans are available?",
        "How can I book a demo?",
      ],
    },
    leadCaptureEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    leadCaptureTitle: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Want our team to follow up with tailored insights?",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    allowedDomains: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ["*"],
    },
  },
  {
    sequelize: database,
    modelName: "BotConfig",
    tableName: "BotConfigs",
    timestamps: true,
  }
);

export default BotConfig;
