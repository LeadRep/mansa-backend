import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

interface Stage {
  id: string;
  name: string;
  color: string;
}

export interface DealsAttributes {
  id: string;
  userId: string;
  stages: Stage[];
}

export class Deals extends Model<DealsAttributes> {
  [x: string]: any;
}

Deals.init(
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
    stages: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    sequelize: database,
    tableName: "Deals",
    timestamps: true,
  }
);

export default Deals;
