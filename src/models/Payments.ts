import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";
export interface PaymentAttributes {
  id: string;
  user_id: string;
  customer_id?: string;
  session: JSON;
  session_id: string;
  plan_id: string;
  plan_type: string;
  status: string;
  plan_start_date: Date;
  plan_end_date: Date;
  plan_duration: string;
}

export class Payment extends Model<PaymentAttributes> {
  [x: string]: any;
}

Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customer_id: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    session: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    session_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    plan_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    plan_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    plan_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    plan_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    plan_duration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize: database,
    tableName: "Payment",
    timestamps: true,
  }
);

export default Payment;
