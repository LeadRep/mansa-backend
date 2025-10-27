import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";
import Organizations from "./Organizations";

export interface MonthlyQuotasAttributes {
    organization_id: string;
    startDate: Date,
    remaining: number;
}

export class MonthlyQuotas extends Model<MonthlyQuotasAttributes> {
    [x: string]: any;
}

MonthlyQuotas.init(
    {
        organization_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: Organizations,
                key: "organization_id",
            },
            onDelete: "CASCADE",
            primaryKey: true,
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: false,
            validate: {
                isDate: true,
            },
            primaryKey: true,
        },
        remaining: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        }
    },
    {
        sequelize: database,
        tableName: "MonthlyQuotas",
        timestamps: true
    }
);

export default MonthlyQuotas;