// import { DataTypes, Model } from "sequelize";
// import { database } from "../configs/database/database";

// export enum LeadStatus {
//   NEW = "new",
//   SAVED = "saved",
//   DELETED = "deleted",
//   VIEWED = "viewed",
//   RESERVE = "reserve",
// }

// export interface LeadsAttributes {
//   id: string;
//   external_id: string;
//   owner_id: string;
//   first_name: string;
//   last_name: string;
//   full_name: string;
//   name: string;
//   linkedin_url: string;
//   title: string;
//   photo_url: string;
//   twitter_url: string;
//   github_url: string;
//   facebook_url: string;
//   headline: string;
//   email_status: string;
//   extrapolated_email_confidence: number;
//   email: string;
//   phone: string;
//   organization_id: string;
//   organization: JSON;
//   employment_history: JSON;
//   departments: string[];
//   subdepartments: string[];
//   seniority: string;
//   functions: string[];
//   state: string;
//   city: string;
//   country: string;
//   street_address: string;
//   postal_code: string;
//   formatted_address: string;
//   time_zone: string;
//   category: string;
//   reason: string;
//   score: number;
//   intent_strength: string;
//   show_intent: boolean;
//   email_domain_catchall: boolean;
//   revealed_for_current_team: boolean;
// }

// export class Leads extends Model<LeadsAttributes> {
//   [x: string]: any;
// }

// Leads.init(
//   {
//     id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//       unique: true,
//     },
//     external_id: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     owner_id: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     first_name: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     last_name: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     full_name: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     name: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     linkedin_url: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//       defaultValue: null,
//     },
//     title: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     photo_url: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//       defaultValue: null,
//     },
//     twitter_url: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     github_url: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     facebook_url: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     headline: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//       defaultValue: null,
//     },
//     email_status: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     extrapolated_email_confidence: {
//       type: DataTypes.FLOAT,
//       allowNull: true,
//       defaultValue: null,
//     },
//     email: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     phone: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     organization_id: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     organization: {
//       type: DataTypes.JSON,
//       allowNull: true,
//       defaultValue: null,
//     },
//     employment_history: {
//       type: DataTypes.JSON,
//       allowNull: true,
//       defaultValue: null,
//     },
//     departments: {
//       type: DataTypes.ARRAY(DataTypes.STRING),
//       allowNull: true,
//       defaultValue: null,
//     },
//     subdepartments: {
//       type: DataTypes.ARRAY(DataTypes.STRING),
//       allowNull: true,
//       defaultValue: null,
//     },
//     seniority: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     functions: {
//       type: DataTypes.ARRAY(DataTypes.STRING),
//       allowNull: true,
//       defaultValue: null,
//     },
//     state: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     city: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     country: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     street_address: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     postal_code: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     formatted_address: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     time_zone: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     category: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     reason: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//       defaultValue: null,
//     },
//     score: {
//       type: DataTypes.INTEGER,
//       allowNull: true,
//       defaultValue: null,
//     },
//     intent_strength: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//     show_intent: {
//       type: DataTypes.BOOLEAN,
//       allowNull: true,
//       defaultValue: null,
//     },
//     email_domain_catchall: {
//       type: DataTypes.BOOLEAN,
//       allowNull: true,
//       defaultValue: null,
//     },
//     revealed_for_current_team: {
//       type: DataTypes.BOOLEAN,
//       allowNull: true,
//       defaultValue: null,
//     },
//   },
//   {
//     sequelize: database,
//     modelName: "Leads",
//     timestamps: true,
//   }
// );
