import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";
import PublicChatSession from "./PublicChatSession";

export type PublicMessageRole = "user" | "assistant" | "system";

export interface PublicChatMessageAttributes {
  id: string;
  sessionId: string;
  role: PublicMessageRole;
  content: string;
  sources?: any;
  feedback?: "like" | "dislike" | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PublicChatMessageCreationAttributes = Optional<
  PublicChatMessageAttributes,
  "id" | "sources" | "feedback"
>;

export class PublicChatMessage
  extends Model<
    PublicChatMessageAttributes,
    PublicChatMessageCreationAttributes
  >
  implements PublicChatMessageAttributes
{
  public id!: string;
  public sessionId!: string;
  public role!: PublicMessageRole;
  public content!: string;
  public sources!: any;
  public feedback!: "like" | "dislike" | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PublicChatMessage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "PublicChatSessions",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    role: {
      type: DataTypes.ENUM("user", "assistant", "system"),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sources: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    feedback: {
      type: DataTypes.ENUM("like", "dislike"),
      allowNull: true,
    },
  },
  {
    sequelize: database,
    modelName: "PublicChatMessage",
    tableName: "PublicChatMessages",
    timestamps: true,
  }
);

PublicChatSession.hasMany(PublicChatMessage, {
  foreignKey: "sessionId",
  as: "messages",
  onDelete: "CASCADE",
});

PublicChatMessage.belongsTo(PublicChatSession, {
  foreignKey: "sessionId",
  as: "session",
});

export default PublicChatMessage;
