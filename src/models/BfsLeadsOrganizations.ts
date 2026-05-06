import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

export interface BfsLeadsOrganizationsAttributes {
  id: string;
  bfs_id: string;
  organization_id: string;
  loaded_by: string;
}

export class BfsLeadsOrganization extends Model<BfsLeadsOrganizationsAttributes> {
  [x: string]: any;
}

BfsLeadsOrganization.init(
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    bfs_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    loaded_by: {
      type: DataTypes.UUID,
      allowNull: true,
    }
  },
  {
    sequelize: database,
    modelName: "BfsLeadsOrganizations",
    tableName: "bfs_leads_organizations",
    timestamps: true,
    indexes: [
      { name: "idx_bfs_leads_org_bfs_id_organization_id", fields: ["bfs_id", "organization_id"] },
      { name: "idx_bfs_leads_org_bfs_id_loaded_by", fields: ["bfs_id", "loaded_by"] }
    ]
  }
);

export default BfsLeadsOrganization;