// typescript
'use strict';


module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Ensure the column exists on Organizations
      await queryInterface.addColumn(
        'Organizations',
        'next_refresh',
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );

      // Copy any user's CustomerPrefs.nextRefresh into the organization's next_refresh
      await queryInterface.sequelize.query(
        `
        UPDATE "Organizations" o
        SET "next_refresh" = sub."nextRefresh"
        FROM (
          SELECT u.organization_id AS org_id, cp."nextRefresh"
          FROM "CustomerPrefs" cp
          JOIN "Users" u ON cp."userId" = u.id
          WHERE cp."nextRefresh" IS NOT NULL
          GROUP BY u.organization_id, cp."nextRefresh"
        ) AS sub
        WHERE o.organization_id = sub.org_id
          AND (o."next_refresh" IS NULL);
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Revert: remove the column added in up
      await queryInterface.removeColumn('Organizations', 'next_refresh', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};