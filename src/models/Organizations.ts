import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";

export interface OrganizationsAttributes {
    organization_id: string;
    name: string;
    website?: string;
    address?: string;
    country?: string;
    city?: string;
    plan: string;
    subscriptionStartDate?: Date;
    subscriptionEndDate?: Date;
    basicModules?: boolean;
    imModule?: boolean;
    demoAccount?: boolean;
    nextRefresh?: Date;
}

export class Organizations extends Model<OrganizationsAttributes> {
    [x: string]: any;
}

Organizations.init(
    {
        organization_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        website: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        country: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        plan: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "free"
        },
        subscriptionStartDate: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            validate: {
                isDate: true,
            },
        },
        subscriptionEndDate: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            validate: {
                isDate: true,
            },
        },
        nextRefresh: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
          validate: {
            isDate: true,
          },
          field: "next_refresh",
        },
        basicModules: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: "basic_modules", // Maps to snake_case in DB
        },
        imModule: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "im_module", // Maps to snake_case in DB
        },
        demoAccount: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "demo_account", // Maps to snake_case in DB
        }
    },
    {
        sequelize: database,
        tableName: "Organizations",
        timestamps: true
    }
);

export default Organizations;