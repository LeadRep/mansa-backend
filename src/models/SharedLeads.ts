import { DataTypes, Model, Optional } from "sequelize";
import Users from "./Users";
import { database } from "../configs/database/database";

export interface SharedLeadsAttributes {
    id: string;
    token: string;
    userId: string;
    leadIds: string[]; // array of lead IDs stored in JSONB
    expiresAt: Date;
    accessedCount?: number;
    lastAccessedAt?: Date | null;
}

export type SharedLeadsCreationAttributes = Optional<
    SharedLeadsAttributes,
    "id" | "accessedCount" | "lastAccessedAt"
>;

export class SharedLeads
    extends Model<SharedLeadsAttributes, SharedLeadsCreationAttributes>
    implements SharedLeadsAttributes
{
    public id!: string;
    public token!: string;
    public userId!: string;
    public leadIds!: string[];
    public expiresAt!: Date;
    public accessedCount!: number;
    public lastAccessedAt!: Date | null;

    // Associations helper
    public static associate(models: any) {
        // expects `models.User` to exist
        SharedLeads.belongsTo(models.Users, {
            foreignKey: "user_id",
            as: "user",
            onDelete: "CASCADE",
        });
    }
}

// Initialize the model
SharedLeads.init(
    {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        token: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: "user_id",
            references: {
                model: Users,
                key: 'id',
            },
            onDelete: 'CASCADE'
        },
        leadIds: {
            type: DataTypes.JSONB,
            allowNull: false,
            field: "lead_ids",
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "expires_at",
        },
        accessedCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: "accessed_count",
            defaultValue: 0,
        },
        lastAccessedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "last_accessed_at",
        },
    },
    {
        sequelize: database,
        tableName: "SharedLeads",
        timestamps: true,
        indexes: [
            {
                name: "idx_shared_leads_token",
                fields: ["token"],
            },
            {
                name: "idx_shared_leads_expires_at",
                fields: ["expires_at"],
            },
        ],
    }
);

export default SharedLeads;