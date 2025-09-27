import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";
import Organizations from "./Organizations";

export interface TeamsAttributes {
    team_id: string;
    organization_id: string;
    name: string;
    description?: string | null;
}

export class Teams extends Model<TeamsAttributes> {
    [x: string]: any;
}

Teams.init(
    {
        team_id: {
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
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
        }
    },
    {
        sequelize: database,
        tableName: "Teams",
        timestamps: true,
        indexes: [
            // UNIQUE (organization_id, name)
            {
                unique: true,
                fields: ["organization_id", "name"],
                name: "teams_org_name_uniq",
            }
        ],
    }
);

export default Teams;