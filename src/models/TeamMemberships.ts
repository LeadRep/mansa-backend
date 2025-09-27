import {
    Model,
    DataTypes,
} from "sequelize";
import { database } from "../configs/database/database";
import Users from "./Users";
import Teams from "./Teams";
import Organizations from "./Organizations";

export type TeamRole = "lead" | "member" | "viewer";

export interface TeamMembershipsAttributes {
    team_id: string;
    user_id: string;
    organization_id: string;
    team_role: TeamRole;
}

export class TeamMemberships extends Model<TeamMembershipsAttributes> {
    [x: string]: any;
}

TeamMemberships.init(
    {
        team_id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true, // part of composite PK (team_id, user_id)
            references: {
                model: Teams,
                key: "team_id",
            },
            onDelete: "CASCADE",
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true, // part of composite PK (team_id, user_id)
            references: {
                model: Users,
                key: "id",
            },
            onDelete: "CASCADE",
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
        // Mirror CHECK (team_role in (...)) with an enum type
        team_role: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: "member",
        }
    },
    {
        sequelize: database,
        tableName: "TeamMemberships",
        timestamps: true,
        indexes: [
            // create index team_memberships_org_idx on team_memberships (organization_id);
            { name: "team_memberships_org_idx", fields: ["organization_id"] },
            // create index team_memberships_user_idx on team_memberships (user_id);
            { name: "team_memberships_user_idx", fields: ["user_id"] },
            // create index team_memberships_team_idx on team_memberships (team_id);
            { name: "team_memberships_team_idx", fields: ["team_id"] },
        ],
    }
);

export default TeamMemberships;