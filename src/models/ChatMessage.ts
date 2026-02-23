import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ChatMessageAttributes {
  id: string;
  sessionId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type ChatMessageCreationAttributes = Optional<ChatMessageAttributes, "id">;

export class ChatMessage
  extends Model<ChatMessageAttributes, ChatMessageCreationAttributes>
  implements ChatMessageAttributes
{
  public id!: string;
  public sessionId!: string;
  public userId!: string;
  public role!: ChatMessageRole;
  public content!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChatMessage.init(
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
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("user", "assistant", "system"),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize: database,
    modelName: "ChatMessage",
    tableName: "ChatMessages",
    timestamps: true,
  }
);
