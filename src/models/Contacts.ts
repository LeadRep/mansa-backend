import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";
import Users from "./Users";
import UserLinkedAccounts from "./UserLinkedAccounts";
import {WarmLeads} from "./WarmLeads";

export interface ContactsAttributes {
    contact_id: string;
    user_id: string;
    user_account_id: string;
    source_contact_id: string;
    raw_data: object;
    full_name?: string;
    email?: string;
    phone?: string;
    is_complete: boolean;
    validation_required: boolean;
    is_skipped: boolean;
    first_name?: string;
    last_name?: string;
    is_enriched?: boolean;
    warmlead_id?: string | null;
}

export class Contacts extends Model<ContactsAttributes> {
    [x: string]: any;
}

Contacts.init(
    {
        contact_id: {
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
                key: "id",
            },
            onDelete: "CASCADE",
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
        source_contact_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        raw_data: {
            type: DataTypes.JSONB,
            allowNull: false,
        },
        first_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        last_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        full_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        is_complete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        validation_required: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        is_skipped: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        is_enriched: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        warmlead_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: WarmLeads,
                key: "id", // or the primary key of WarmLeads
            },
            onDelete: "SET NULL",
        }
    },
    {
        sequelize: database,
        tableName: "Contacts",
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'user_account_id', 'source_contact_id'],
            },
        ]
    }
);

export default Contacts;