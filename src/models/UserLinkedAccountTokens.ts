import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";
import UserLinkedAccounts from "./UserLinkedAccounts";

export enum TokenScope {
    SCOPE1 = 1, // contacts openid email
    SCOPE2 = 2,
}

export interface UserLinkedAccountsTokenAttributes {
    token_id: string;
    user_account_id: string;
    encrypted_refresh_token: string;
    scope: TokenScope;
    last_used_at?: Date;
}

export class UserLinkedAccountsToken extends Model<UserLinkedAccountsTokenAttributes> {
    [x: string]: any;
}

UserLinkedAccountsToken.init(
    {
        token_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            unique: true,
        },
        user_account_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: UserLinkedAccounts,
                key: "user_account_id",
            },
            onDelete: "CASCADE",
        },
        encrypted_refresh_token: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        scope: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        last_used_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize: database,
        tableName: "UserLinkedAccountsToken",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['user_account_id', 'scope'],
            },
        ]
    }
);

export default UserLinkedAccountsToken;