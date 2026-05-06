import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";
import BfsLeadsOrganizations from "./BfsLeadsOrganizations";

export interface BfsLeadsAttributes {
  bfs_id: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  company_name?: string;
  email?: string;
  result_overall?: JSON | null;
  external_id?: string;
  result?: JSON | null;
}

export class BfsLeads extends Model<BfsLeadsAttributes> {
  [x: string]: any;
}

BfsLeads.init(
  {
    bfs_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    company_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    result_overall: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    external_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    result: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize: database,
    modelName: "BfsLeads",
    tableName: "bfs_leads",
    timestamps: true,
    indexes: [
      {
        name: "bfs_leads_email_idx",
        fields: ['email'],
      },
      {
        name: "bfs_leads_external_id_idx",
        fields: ['external_id'],
      },
    ]
  }
);

BfsLeads.hasMany(BfsLeadsOrganizations, { as: 'organizations', foreignKey: 'bfs_id', sourceKey: 'bfs_id' })
export default BfsLeads;