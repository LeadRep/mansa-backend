import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";
import Users from "./Users";

export interface PasswordResetTokenAttributes {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

interface PasswordResetTokenCreationAttributes
  extends Optional<PasswordResetTokenAttributes, "id"> {}

export class PasswordResetToken
  extends Model<PasswordResetTokenAttributes, PasswordResetTokenCreationAttributes>
  implements PasswordResetTokenAttributes
{
  public id!: string;
  public userId!: string;
  public token!: string;
  public expiresAt!: Date;
}

PasswordResetToken.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Users,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize: database,
    tableName: "PasswordResetTokens",
    timestamps: true,
  }
);

Users.hasMany(PasswordResetToken, { foreignKey: "userId", as: "passwordResetTokens" });
PasswordResetToken.belongsTo(Users, { foreignKey: "userId", as: "user" });

export default PasswordResetToken;
