import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export interface ChatSessionAttributes {
  id: string;
  userId: string;
  title: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ChatSessionCreationAttributes = Optional<ChatSessionAttributes, "id" | "title">;

export class ChatSession
  extends Model<ChatSessionAttributes, ChatSessionCreationAttributes>
  implements ChatSessionAttributes
{
  public id!: string;
  public userId!: string;
  public title!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChatSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "New Chat",
    },
  },
  {
    sequelize: database,
    modelName: "ChatSession",
    tableName: "ChatSessions",
    timestamps: true,
  }
);
