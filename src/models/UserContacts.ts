import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";
import Users from "./Users";


export enum ContactProvider {
    CUSTOM = "custom",
    GOOGLE = "google",
    MICROSOFT = "microsoft",
}

export enum UserContactsStatus {
    INIT = "init",
    EMAIL_SET = "email_set",
    CONTACTS_SET = "contacts_set",
}


export interface UserContactsAttributes {
    id: string;
    user_id: string;
    refresh_token: string;
    provider: ContactProvider;
    provider_reference: string;
    status: UserContactsStatus;
    contacts_json: object;
}

export class UserContacts extends Model<UserContactsAttributes> {
    [x: string]: any;
}

UserContacts.init(
    {
        id: {
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
        provider_reference: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        refresh_token: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        provider: {
            type: DataTypes.ENUM(...Object.values(ContactProvider)),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM(...Object.values(UserContactsStatus)),
            allowNull: false,
            defaultValue: UserContactsStatus.INIT,
        },
        contacts_json: {
            type: DataTypes.JSONB,
            allowNull: true,
        }
    },
    {
        sequelize: database,
        tableName: 'UserContacts',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'provider', 'provider_reference'],
            },
        ]
    }
);

export default UserContacts;