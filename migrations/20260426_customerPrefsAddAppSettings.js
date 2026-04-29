'use strict';

const { Sequelize } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Helper function to check if column exists
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

      // Add appSettings column if it doesn't exist
      const appSettingsExists = await columnExists('CustomerPrefs', 'appSettings');
      if (!appSettingsExists) {
        await queryInterface.addColumn('CustomerPrefs', 'appSettings', {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: null,
        }, { transaction });
        console.log('Added appSettings column to CustomerPrefs table');
      } else {
        console.log('appSettings column already exists in CustomerPrefs table');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Helper function to check if column exists
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

      // Remove appSettings column if it exists
      const appSettingsExists = await columnExists('CustomerPrefs', 'appSettings');
      if (appSettingsExists) {
        await queryInterface.removeColumn('CustomerPrefs', 'appSettings', { transaction });
        console.log('Removed appSettings column from CustomerPrefs table');
      } else {
        console.log('appSettings column does not exist in CustomerPrefs table');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};