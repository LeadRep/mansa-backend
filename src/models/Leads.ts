import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

export enum LeadStatus {
  NEW = "new",
  SAVED = "saved",
  DELETED = "deleted",
  VIEWED = "viewed",
  RESERVE = "reserve",
}

export interface LeadsAttributes {
  id: string;
  external_id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  linkedin_url: string;
  title: string;
  photo_url: string;
  twitter_url: string;
  github_url: string;
  facebook_url: string;
  headline: string;
  email: string;
  phone: string;
  organization: JSON;
  departments: string[];
  state: string;
  city: string;
  country: string;
  category: string;
  reason: string;
  score: number;
  status?: string;
  views?: number;
}

export class Leads extends Model<LeadsAttributes> {
  [x: string]: any;
}

Leads.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    external_id: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    owner_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    linkedin_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    twitter_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    github_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    facebook_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    headline: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    organization: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    departments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: null,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: LeadStatus.NEW,
      allowNull: false,
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
  },
  {
    sequelize: database,
    modelName: "Leads",
    timestamps: true,
  }
);


export class ArchivedSharedLeads extends Model<LeadsAttributes> {
  [x: string]: any;
}

ArchivedSharedLeads.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      unique: true,
    },
    external_id: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    owner_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    linkedin_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    twitter_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    github_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    facebook_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    headline: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    organization: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    departments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: null,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: LeadStatus.NEW,
      allowNull: false,
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
  },
  {
    sequelize: database,
    modelName: "ArchivedSharedLeads",
    timestamps: true,
  }
);