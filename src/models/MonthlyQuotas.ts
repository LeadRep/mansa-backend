import {Model, DataTypes, Optional} from "sequelize";
import { database } from "../configs/database/database";
import Organizations from "./Organizations";

export interface MonthlyQuotasAttributes {
    organization_id: string;
    startDate: string,
    remaining: number;
}

// 2. Define the Creation Attributes Interface (what can be omitted during creation)
// We make the composite primary keys 'organization_id' and 'startDate' optional
// because they are passed in the 'where' clause of findOrCreate.
export interface MonthlyQuotasCreationAttributes extends
    Optional<MonthlyQuotasAttributes, 'organization_id' | 'startDate'> {}

export class MonthlyQuotas extends Model<MonthlyQuotasAttributes, MonthlyQuotasCreationAttributes> {
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
            type: DataTypes.STRING,
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