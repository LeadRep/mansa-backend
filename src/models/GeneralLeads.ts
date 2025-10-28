import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export interface GeneralLeadsAttributes {
  id: string;
  external_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  name: string | null;
  linkedin_url: string | null;
  title: string | null;
  photo_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  facebook_url: string | null;
  headline: string | null;
  email_status: string | null;
  extrapolated_email_confidence: number | null;
  email: string | null;
  phone: string | null;
  organization_id: string | null;
  organization: JSON | null;
  employment_history: JSON | null;
  departments: string[] | null;
  subdepartments: string[] | null;
  seniority: string | null;
  functions: string[] | null;
  state: string | null;
  city: string | null;
  country: string | null;
  street_address: string | null;
  postal_code: string | null;
  formatted_address: string | null;
  time_zone: string | null;
  category: string | null;
  reason: string | null;
  score: number | null;
  intent_strength: string | null;
  show_intent: boolean | null;
  email_domain_catchall: boolean | null;
  revealed_for_current_team: boolean | null;
}

export type GeneralLeadsCreationAttributes = Optional<GeneralLeadsAttributes, "id">;

export class GeneralLeads extends Model<GeneralLeadsAttributes, GeneralLeadsCreationAttributes> {
  [x: string]: any;
}

GeneralLeads.init(
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
    name: {
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
    email_status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    extrapolated_email_confidence: {
      type: DataTypes.FLOAT,
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
    organization_id: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    organization: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    employment_history: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    departments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: null,
    },
    subdepartments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: null,
    },
    seniority: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    functions: {
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
    street_address: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    postal_code: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    formatted_address: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    time_zone: {
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
    intent_strength: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    show_intent: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    email_domain_catchall: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    revealed_for_current_team: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize: database,
    modelName: "GeneralLeads",
    timestamps: true,
  }
);
