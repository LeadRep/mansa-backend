import { DataTypes, Model, Optional } from "sequelize";
import Organizations from "./Organizations";
import Users from "./Users"; // adjust path to your sequelize instance
import { database } from "../configs/database/database";

interface InvitationAttributes {
    invitation_id: string;
    organization_id: string;
    email: string;
    firstName: string | undefined;
    lastName: string | undefined;
    role: string;
    inviter_id: string;
    token: string;
    status: "pending" | "accepted" | "declined";
    expiryAt?: Date | null;
}

export class Invitations extends Model<InvitationAttributes> {
    [x: string]: any;
}

Invitations.init(
    {
        invitation_id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            unique: true,
        },
        organization_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: Organizations,
                key: "organization_id",
            },
            onDelete: "CASCADE",
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        firstName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        lastName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        role: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        inviter_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: Users,
                key: "id",
            }
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "pending",
        },
        expiryAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
    },
    {
        sequelize: database,
        tableName: "Invitations",
        timestamps: true,
        indexes: [
            {
                name: "org_invitations_email_idx",
                unique: true,
                fields: ['organization_id', 'email'],
            }
        ]
    }
);

Invitations.belongsTo(Organizations, {
  foreignKey: "organization_id",
  as: "organization",
});

export default Invitations;