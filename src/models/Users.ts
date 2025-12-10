import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";
import Organizations from "./Organizations";

export enum userRole {
  ADMIN = "admin",
  USER = "user",
  COMPANY = "company",
}

export interface UsersAttributes {
  id: string;
  firstName: string;
  lastName: string;
  userName?: string;
  email: string;
  phone?: string;
  picture?: string;
  organization_id: string;
  companyName?: string;
  role: string;
  orgRole: string;
  website?: string;
  address?: string;
  country?: string;
  city?: string;
  bio?: string;
  password: string;
  subscriptionName?: string | null;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  lastSeen?: Date | null;
  isVerified: boolean;
  isBlocked: Date | null;
}

export class Users extends Model<UsersAttributes> {
  [x: string]: any;
}

Users.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    picture: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Organizations,
        key: "organization_id",
      },
      onDelete: "CASCADE",
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: userRole.USER,
      allowNull: false,
    },
    orgRole: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: null,
    },
    subscriptionName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    subscriptionStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      validate: {
        isDate: true,
      },
    },
    subscriptionEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      validate: {
        isDate: true,
      },
    },
    lastSeen: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "last_seen",
      validate: {
        isDate: true,
      },
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isBlocked: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      validate: {
        isDate: true,
      },
    },
  },
  {
    sequelize: database,
    tableName: "Users",
    timestamps: true,
  }
);

Users.belongsTo(Organizations, {
  foreignKey: "organization_id",
  as: "organization",
});

export default Users;
