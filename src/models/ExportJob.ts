import { DataTypes, Model, Optional } from 'sequelize';
import { database } from '../configs/database/database';

export interface ExportJobAttributes {
  id: string;
  user_id: string;
  organization_id: string;
  format?: string | null;
  status: string;
  total_count?: number | null;
  created_at?: Date;
  completed_at?: Date | null;
}

export type ExportJobCreationAttributes = Optional<ExportJobAttributes, 'id' | 'format' | 'status' | 'total_count' | 'created_at' | 'completed_at'>;

export class ExportJob extends Model<ExportJobAttributes, ExportJobCreationAttributes> implements ExportJobAttributes {
  id!: string;
  user_id!: string;
  organization_id!: string;
  format?: string | null;
  status!: string;
  total_count?: number | null;
  created_at?: Date;
  completed_at?: Date | null;
}

ExportJob.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    format: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    total_count: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    completed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  },
  {
    sequelize: database,
    modelName: 'ExportJob',
    timestamps: true,
    tableName: 'ExportJobs',
  }
);