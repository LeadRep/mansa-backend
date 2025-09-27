"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // 0) Ensure gen_random_uuid() is available (Postgres pgcrypto)
        try {
            await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
        } catch (e) {
            // ignore if not Postgres or no permissions
        }

        // 1) Add columns (nullable initially) if missing
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

        // 2) Add FK constraint Users.organization_id -> Organizations(organization_id)
        // Skip if it already exists
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

        // 3) Add index for lookups (idempotent)
        await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS users_org_idx ON "Users"(organization_id);
    `);

        // 4) Backfill and create memberships:
        //    - base: list users without org with generated org_id
        //    - ins_org: create Organizations
        //    - upd_user: set user.organization_id
        //    - ins_team: create 'primary_team' per org
        //    - ins_membership: add team_memberships rows (user is 'lead' by default)
        await queryInterface.sequelize.query(`
      WITH base AS (
        SELECT
          u.id AS user_id,
          COALESCE(u."subscriptionName", 'free') as plan,
          gen_random_uuid() AS org_id,
          u."createdAt" as created_at,
          u."updatedAt" as updated_at,
          u.website as website,
          u.address as address,
          u.country as country,
          u.city as city,
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
      SELECT t.team_id, b.user_id, t.organization_id, 'lead', b.created_At, b.updated_at
      FROM ins_team t
      JOIN base b ON b.org_id = t.organization_id;
    `);

        // Enforce NOT NULL after verifying all users now have an org
        await queryInterface.changeColumn("Users", "organization_id", {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
        });
    },

    async down(queryInterface, Sequelize) {
        // Revert schema only (do not delete created orgs/teams/memberships automatically)
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