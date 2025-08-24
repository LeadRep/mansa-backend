import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";
import Users from "./Users";

export enum LinkedAccountProvider {
    GOOGLE = "google",
    OUTLOOK = "outlook",
}

export interface UserLinkedAccountsAttributes {
    user_account_id: string;
    user_id: string;
    provider: LinkedAccountProvider;
    provider_account_id: string;
    provider_account_name: string;
}

export class UserLinkedAccounts extends Model<UserLinkedAccountsAttributes> {
    [x: string]: any;
}

UserLinkedAccounts.init(
    {
        user_account_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            unique: true,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: Users,
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        provider: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        provider_account_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        provider_account_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        }
    },
    {
        sequelize: database,
        tableName: "UserLinkedAccounts",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'provider', 'provider_account_id'],
            },
        ]
    }
);

export default UserLinkedAccounts;