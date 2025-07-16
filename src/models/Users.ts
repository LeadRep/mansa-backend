import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

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
  companyName?: string;
  role: string;
  website?: string;
  address?: string;
  country?: string;
  city?: string;
  bio?: string;
  password: string;
  subscriptionName?: string | null;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
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

export default Users;
