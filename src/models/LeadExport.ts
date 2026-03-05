import { DataTypes, Model, Optional } from 'sequelize';
import { database } from '../configs/database/database';

export interface LeadExportAttributes {
  id: string;
  lead_id: string;
  export_job_id: string;
  exported_for_organization_id: string;
  exported_at?: Date;
}

export type LeadExportCreationAttributes = Optional<LeadExportAttributes, 'id' | 'exported_at'>;

export class LeadExport extends Model<LeadExportAttributes, LeadExportCreationAttributes> implements LeadExportAttributes {
  id!: string;
  lead_id!: string;
  export_job_id!: string;
  exported_for_organization_id!: string;
  exported_at?: Date;
}

LeadExport.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lead_id: { type: DataTypes.UUID, allowNull: false },
    export_job_id: { type: DataTypes.UUID, allowNull: false },
    exported_for_organization_id: { type: DataTypes.UUID, allowNull: false },
    exported_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize: database,
    modelName: 'LeadExport',
    timestamps: true,
    tableName: 'LeadExports',
    indexes: [
      {
        name: 'idx_lead_export_lead_org',
        fields: ['lead_id', 'exported_for_organization_id']
      },
      // ... any other existing indexes ...
    ]

  }
);