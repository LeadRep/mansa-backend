import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

export interface AnalyticsEventAttributes {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  event_type: string;
  metadata?: JSON | null;
  createdAt?: Date;
}

export class AnalyticsEvent extends Model<AnalyticsEventAttributes> {
  [x: string]: any;
}

AnalyticsEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    event_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize: database,
    tableName: "AnalyticsEvent",
    timestamps: true,
    updatedAt: false,
  }
);

export default AnalyticsEvent;
