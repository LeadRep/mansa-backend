import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";
import Users from "./Users";

export interface ICP {
  industry: string;
  company_size: string;
  geographical_focus: string;
  business_model: string;
  revenue: string;
  tech_stack: string;
  growth_stage: string;
  pain_points: string;
  buying_triggers: string;
  decision_making_process: string;
}

export interface BP {
  name: string;
  role: string;
  gender: string;
  department: string;
  age_range: string;
  occupation: string;
  locations: string;
  education: string;
  responsibilities: string;
  income_level: string;
  business_model: string;
  challenges: string;
  goals: string;
  buying_power: string;
  objections: string;
  preferred_communication_channel: string;
  motivation: string;
  buying_trigger: string;
}

export enum LeadsGenerationStatus {
  NOT_STARTED = "not_started",
  ONGOING = "ongoing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface CustomerPrefAttributes {
  id: string;
  userId: string;
  prompt?:string | null;
  ICP: JSON;
  BP: JSON;
  territories?: Array<string> | [];
  leadsGenerationStatus?: LeadsGenerationStatus;
  refreshLeads?: number;
  nextRefresh?: Date;
  aiQueryParams?: JSON | null;
  totalPages?: number;
  currentPage?: number;
  subscriptionName?: string | null;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  basicModules?: boolean;
  imModule?: boolean;
  demoMode?: boolean;
}

export class CustomerPref extends Model<CustomerPrefAttributes> {
  [x: string]: any;
}

CustomerPref.init(
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
    prompt:{
      type:DataTypes.STRING,
      allowNull:true,
      defaultValue:null
    },
    ICP: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    BP: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    territories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    leadsGenerationStatus: {
      type: DataTypes.ENUM(...Object.values(LeadsGenerationStatus)),
      allowNull: true,
      defaultValue: LeadsGenerationStatus.COMPLETED,
    },
    refreshLeads: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    nextRefresh: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    aiQueryParams: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    totalPages: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    currentPage: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    subscriptionName: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      field: "subscription_name", // Maps to snake_case in DB
    },
    subscriptionStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "subscription_start_date", // Maps to snake_case in DB
      validate: {
        isDate: true,
      },
    },
    subscriptionEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "subscription_end_date", // Maps to snake_case in DB
      validate: {
        isDate: true,
      },
    },
    basicModules: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "basic_modules", // Maps to snake_case in DB
    },
    imModule: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "im_module", // Maps to snake_case in DB
    },
    demoMode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "demo_mode", // Maps to snake_case in DB
    }
  },
  {
    sequelize: database,
    modelName: "CustomerPref",
  }
);

CustomerPref.belongsTo(Users, {
  foreignKey: "userId",
  as: "user",
});
