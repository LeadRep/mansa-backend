"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // 0) Ensure gen_random_uuid() is available (Postgres pgcrypto)
        try {
            await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
        } catch (e) {
            // ignore if not Postgres or no permissions
        }

        // 1) Add column (nullable initially) if missing
        const usersDesc = await queryInterface.describeTable("Users");
        if (!usersDesc.organization_id) {
            await queryInterface.addColumn("Users", "organization_id", {
                type: Sequelize.DataTypes.UUID,
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

        // 4) Backfill:
        //    For each existing user without an org:
        //      - Create an Organization (plan='free')
        //      - Set user.organization_id to that org
        //      - Create a 'primary_team' row in teams for that org
        //
        // Notes:
        // - Organizations has "createdAt"/"updatedAt" timestamp columns.
        // - teams has created_at timestamp column.
        await queryInterface.sequelize.query(`
      WITH base AS (
        SELECT
          u.id AS user_id,
          gen_random_uuid() AS org_id,
          COALESCE(u."companyName", CONCAT(u."firstName",' ',u."lastName",' Org')) AS org_name
        FROM "Users" u
        WHERE u.organization_id IS NULL
      ),
      ins_org AS (
        INSERT INTO "Organizations" (organization_id, name, plan, "createdAt", "updatedAt")
        SELECT b.org_id, b.org_name, 'free', NOW(), NOW()
        FROM base b
        ON CONFLICT (organization_id) DO NOTHING
        RETURNING organization_id
      ),
      upd_user AS (
        UPDATE "Users" u
        SET organization_id = b.org_id
        FROM base b
        WHERE u.id = b.user_id
        RETURNING u.id, b.org_id
      )
      INSERT INTO teams (id, organization_id, name, description, created_at)
      SELECT gen_random_uuid(), b.org_id, 'primary_team', NULL, NOW()
      FROM base b;
    `);

        // If you later want NOT NULL, do it in a separate migration after verifying data:
        // await queryInterface.changeColumn("Users", "organization_id", {
        //   type: Sequelize.DataTypes.UUID,
        //   allowNull: false,
        // });
    },

    async down(queryInterface, Sequelize) {
        // Revert schema only (do not delete created orgs/teams automatically)
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
    },
};