"use strict";

const {DataTypes} = require("sequelize");
module.exports = {
    async up(queryInterface, Sequelize) {
        // 0) Ensure gen_random_uuid() is available (Postgres pgcrypto)
        try {
            await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
        } catch (e) {
            // ignore if not Postgres or no permissions
        }

        // Create Organizations table if missing
        let hasOrganizations = true;
        try {
            await queryInterface.describeTable("Organizations");
        } catch {
            hasOrganizations = false;
        }
        if (!hasOrganizations) {
            await queryInterface.createTable("Organizations", {
                organization_id: {
                    type: Sequelize.DataTypes.UUID,
                    primaryKey: true,
                    allowNull: false,
                    defaultValue: Sequelize.literal("gen_random_uuid()"),
                },
                name: {
                    type: Sequelize.DataTypes.STRING(255),
                    allowNull: true,
                },
                plan: {
                    type: Sequelize.DataTypes.STRING(255),
                    allowNull: false,
                    defaultValue: "free",
                },
                website: {
                    type: Sequelize.DataTypes.STRING(255),
                    allowNull: true,
                },
                address: {
                    type: Sequelize.DataTypes.STRING(255),
                    allowNull: true,
                },
                country: {
                    type: Sequelize.DataTypes.STRING(255),
                    allowNull: true,
                },
                city: {
                    type: Sequelize.DataTypes.STRING(255),
                    allowNull: true,
                },
                createdAt: {
                    type: Sequelize.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal("now()"),
                },
                updatedAt: {
                    type: Sequelize.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal("now()"),
                },
                subscriptionStartDate: {
                    type: Sequelize.DataTypes.DATE,
                    allowNull: true,
                    defaultValue: null,
                    validate: {
                        isDate: true,
                    },
                },
                subscriptionEndDate: {
                    type: Sequelize.DataTypes.DATE,
                    allowNull: true,
                    defaultValue: null,
                    validate: {
                        isDate: true,
                    },
                },
            });
            await queryInterface.addIndex("Organizations", ["organization_id"], { unique: true, name: "organizations_id_uniq" });
        }

        // Create Teams table if missing
        let hasTeams = true;
        try {
            await queryInterface.describeTable("Teams");
        } catch {
            hasTeams = false;
        }
        if (!hasTeams) {
            await queryInterface.createTable("Teams", {
                team_id: {
                    type: Sequelize.DataTypes.UUID,
                    primaryKey: true,
                    allowNull: false,
                    defaultValue: Sequelize.literal("gen_random_uuid()"),
                },
                organization_id: {
                    type: Sequelize.DataTypes.UUID,
                    allowNull: false,
                },
                name: {
                    type: Sequelize.DataTypes.TEXT,
                    allowNull: false,
                },
                description: {
                    type: Sequelize.DataTypes.TEXT,
                    allowNull: true,
                },
                createdAt: {
                    type: Sequelize.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal("now()"),
                },
                updatedAt: {
                    type: Sequelize.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal("now()"),
                },
            });
            // FK to Organizations
            await queryInterface.addConstraint("Teams", {
                fields: ["organization_id"],
                type: "foreign key",
                name: "teams_organization_fkey",
                references: { table: "Organizations", field: "organization_id" },
                onDelete: "CASCADE",
                onUpdate: "CASCADE",
            });
            // Composite unique (team_id, organization_id) to support composite FKs
            await queryInterface.addIndex("Teams", ["team_id", "organization_id"], { unique: true, name: "teams_id_org_uniq" });
            await queryInterface.addIndex("Teams", ["organization_id", "name"], { unique: true, name: "teams_org_name_uniq" });
            // Index on organization_id
            await queryInterface.addIndex("Teams", ["organization_id"], { name: "teams_org_idx" });
        }

        // Create TeamMemberships table if missing
        let hasTeamMemberships = true;
        try {
            await queryInterface.describeTable("TeamMemberships");
        } catch {
            hasTeamMemberships = false;
        }
        if (!hasTeamMemberships) {
            await queryInterface.createTable("TeamMemberships", {
                team_id: { type: Sequelize.DataTypes.UUID, allowNull: false, primaryKey: true },
                user_id: { type: Sequelize.DataTypes.UUID, allowNull: false, primaryKey: true },
                organization_id: { type: Sequelize.DataTypes.UUID, allowNull: false },
                team_role: {
                    type: Sequelize.DataTypes.STRING(255),
                    allowNull: false,
                    defaultValue: "member",
                },
                createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("now()") },
                updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("now()") },
            });
            // indexes only; FKs will be added later after Users column/index exist
            await queryInterface.addIndex("TeamMemberships", ["organization_id"], { name: "team_memberships_org_idx" });
            await queryInterface.addIndex("TeamMemberships", ["user_id"], { name: "team_memberships_user_idx" });
            await queryInterface.addIndex("TeamMemberships", ["team_id"], { name: "team_memberships_team_idx" });
        }

        // 1) Add columns to Users first (so FKs can reference them)
        const usersDesc = await queryInterface.describeTable("Users");
        if (!usersDesc.organization_id) {
            await queryInterface.addColumn("Users", "organization_id", {
                type: Sequelize.DataTypes.UUID,
                allowNull: true,
            });
        }
        if (!usersDesc.orgRole) {
            await queryInterface.addColumn("Users", "orgRole", {
                type: Sequelize.DataTypes.STRING,
                allowNull: true,
            });
        }

        // 2) Add FK Users.organization_id -> Organizations(organization_id)
        await queryInterface.sequelize.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'users_organization_id_fkey'
            ) THEN
              ALTER TABLE "Users"
              ADD CONSTRAINT users_organization_id_fkey
              FOREIGN KEY (organization_id)
              REFERENCES "Organizations"(organization_id)
              ON UPDATE CASCADE
              ON DELETE SET NULL;
            END IF;
          END
          $$;
        `);

        // 3) Ensure uniqueness target for composite FK: Users(id, organization_id) must be UNIQUE
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS users_id_org_uniq
                ON "Users"(id, organization_id);
        `);

        // 4) Teams side: ensure composite uniqueness for (team_id, organization_id) already exists
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS teams_id_org_uniq
                ON "Teams"(team_id, organization_id);
        `);

        // 5) Backfill and create memberships (fix created_At -> created_at)
        await queryInterface.sequelize.query(`
          WITH base AS (
            SELECT
              u.id AS user_id,
              COALESCE(u."subscriptionName", 'free') AS plan,
              gen_random_uuid() AS org_id,
              u."createdAt" AS created_at,
              u."updatedAt" AS updated_at,
              u.website AS website,
              u.address AS address,
              u.country AS country,
              u.city AS city,
              COALESCE(u."companyName", CONCAT(u."firstName",' ',u."lastName",' Org')) AS org_name
            FROM "Users" u
            WHERE u.organization_id IS NULL
          ),
          ins_org AS (
            INSERT INTO "Organizations" (organization_id, name, plan, "createdAt", "updatedAt", website, address, country, city)
            SELECT b.org_id, b.org_name, b.plan, b.created_at, b.updated_at, b.website, b.address, b.country, b.city
            FROM base b
            ON CONFLICT (organization_id) DO NOTHING
            RETURNING organization_id
          ),
          upd_user AS (
            UPDATE "Users" u
            SET organization_id = b.org_id, "orgRole" = 'admin'
            FROM base b
            WHERE u.id = b.user_id
            RETURNING u.id, b.org_id
          ),
          ins_team AS (
            INSERT INTO "Teams" (team_id, organization_id, name, description, "createdAt", "updatedAt")
            SELECT gen_random_uuid(), b.org_id, 'primary_team', NULL, b.created_at, b.updated_at
            FROM base b
            RETURNING team_id, organization_id
          )
          INSERT INTO "TeamMemberships" (team_id, user_id, organization_id, team_role, "createdAt", "updatedAt")
          SELECT t.team_id, b.user_id, t.organization_id, 'lead', b.created_at, b.updated_at
          FROM ins_team t
          JOIN base b ON b.org_id = t.organization_id;
        `);

        // 6) Now that Users has organization_id and the unique index exists, add composite FKs to TeamMemberships
        await queryInterface.sequelize.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'team_memberships_team_org_fkey'
            ) THEN
              ALTER TABLE "TeamMemberships"
              ADD CONSTRAINT team_memberships_team_org_fkey
              FOREIGN KEY (team_id, organization_id)
              REFERENCES "Teams"(team_id, organization_id)
              ON UPDATE CASCADE
              ON DELETE CASCADE;
            END IF;
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'team_memberships_user_org_fkey'
            ) THEN
              ALTER TABLE "TeamMemberships"
              ADD CONSTRAINT team_memberships_user_org_fkey
              FOREIGN KEY (user_id, organization_id)
              REFERENCES "Users"(id, organization_id)
              ON UPDATE CASCADE
              ON DELETE CASCADE;
            END IF;
          END
          $$;
        `);

        // 7) Finally enforce NOT NULL once data is backfilled
        await queryInterface.changeColumn("Users", "organization_id", {
            type: Sequelize.DataTypes.UUID,
            allowNull: false,
        });
    },


    async down(queryInterface, Sequelize) {
        // Revert schema only (indexes + FKs + columns). Data drops are optional/dangerous.

        // TeamMemberships FKs and indexes
        try { await queryInterface.removeConstraint("TeamMemberships", "team_memberships_team_org_fkey"); } catch {}
        try { await queryInterface.removeConstraint("TeamMemberships", "team_memberships_user_org_fkey"); } catch {}
        try { await queryInterface.removeIndex("TeamMemberships", "team_memberships_org_idx"); } catch {}
        try { await queryInterface.removeIndex("TeamMemberships", "team_memberships_user_idx"); } catch {}
        try { await queryInterface.removeIndex("TeamMemberships", "team_memberships_team_idx"); } catch {}
        try { await queryInterface.dropTable("TeamMemberships"); } catch {}

        // Teams FKs and indexes
        try { await queryInterface.removeConstraint("Teams", "teams_organization_fkey"); } catch {}
        try { await queryInterface.removeIndex("Teams", "teams_id_org_uniq"); } catch {}
        try { await queryInterface.removeIndex("Teams", "teams_org_idx"); } catch {}
        try { await queryInterface.dropTable("Teams"); } catch {}

        // Organizations indexes
        try { await queryInterface.removeIndex("Organizations", "organizations_id_uniq"); } catch {}
        try { await queryInterface.removeIndex("Organizations", "organizations_name_uniq"); } catch {}
        try { await queryInterface.dropTable("Organizations"); } catch {}

        // Users FK/index/columns
        try {
            await queryInterface.sequelize.query(`DROP INDEX IF EXISTS users_org_idx;`);
        } catch (e) {}
        try {
            await queryInterface.sequelize.query(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'users_organization_id_fkey'
                ) THEN
                  ALTER TABLE "Users" DROP CONSTRAINT users_organization_id_fkey;
                END IF;
              END
              $$;
            `);
        } catch (e) {}

        const usersDesc = await queryInterface.describeTable("Users");
        if (usersDesc.organization_id) {
            await queryInterface.removeColumn("Users", "organization_id");
        }
        if (usersDesc.orgRole) {
            await queryInterface.removeColumn("Users", "orgRole");
        }
    },
};