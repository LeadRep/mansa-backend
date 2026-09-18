'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columnExists = async (tableName, columnName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT column_name FROM information_schema.columns
           WHERE LOWER(table_name) = LOWER($1)
             AND column_name = $2
             AND table_schema = current_schema()`,
          {
            bind: [tableName, columnName],
            type: Sequelize.QueryTypes.SELECT,
            transaction,
          }
        );

        return result.length > 0;
      };

      const columnName = 'lemlistApiKeyEncrypted';

      if (!(await columnExists('CustomerPrefs', columnName))) {
        await queryInterface.addColumn(
          'CustomerPrefs',
          columnName,
          {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE "CustomerPrefs"
         SET "lemlistApiKeyEncrypted" = COALESCE(
           "lemlistApiKeyEncrypted",
           "appSettings"::jsonb #>> '{integrations,lemlist,apiKeyEncrypted}',
           "appSettings"::jsonb #>> '{integrations,Lemlist,apiKeyEncrypted}',
           "appSettings"::jsonb #>> '{lemlist,apiKeyEncrypted}',
           "appSettings"::jsonb #>> '{Lemlist,apiKeyEncrypted}'
         )
         WHERE "appSettings" IS NOT NULL
           AND jsonb_typeof("appSettings"::jsonb) = 'object'
           AND (
             "appSettings"::jsonb #>> '{integrations,lemlist,apiKeyEncrypted}' IS NOT NULL
             OR "appSettings"::jsonb #>> '{integrations,Lemlist,apiKeyEncrypted}' IS NOT NULL
             OR "appSettings"::jsonb #>> '{lemlist,apiKeyEncrypted}' IS NOT NULL
             OR "appSettings"::jsonb #>> '{Lemlist,apiKeyEncrypted}' IS NOT NULL
           )`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "CustomerPrefs"
         SET "appSettings" = (
           CASE
             WHEN "appSettings" IS NULL THEN NULL
             ELSE (
               "appSettings"::jsonb
                 #- '{integrations,lemlist,apiKeyEncrypted}'
                 #- '{integrations,Lemlist,apiKeyEncrypted}'
                 #- '{lemlist,apiKeyEncrypted}'
                 #- '{Lemlist,apiKeyEncrypted}'
             )::json
           END
         )
         WHERE "appSettings" IS NOT NULL
           AND jsonb_typeof("appSettings"::jsonb) = 'object'`,
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const columnExists = async (tableName, columnName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT column_name FROM information_schema.columns
           WHERE LOWER(table_name) = LOWER($1)
             AND column_name = $2
             AND table_schema = current_schema()`,
          {
            bind: [tableName, columnName],
            type: Sequelize.QueryTypes.SELECT,
            transaction,
          }
        );

        return result.length > 0;
      };

      if (await columnExists('CustomerPrefs', 'lemlistApiKeyEncrypted')) {
        await queryInterface.removeColumn('CustomerPrefs', 'lemlistApiKeyEncrypted', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};