import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

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

export interface CustomerPrefAttributes {
  id: string;
  userId: string;
  ICP: JSON;
  BP: JSON;
  territories?: Array<string> | [];
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
  },
  {
    sequelize: database,
    modelName: "CustomerPref",
  }
);
