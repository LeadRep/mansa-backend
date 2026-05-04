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

      // Add ICP column if it doesn't exist
      const icpExists = await columnExists('Invitations', 'ICP');
      if (!icpExists) {
        await queryInterface.addColumn('Invitations', 'ICP', {
          type: Sequelize.JSON,
          allowNull: true,
        }, { transaction });
        console.log('Added ICP column to Invitations table');
      } else {
        console.log('ICP column already exists in Invitations table');
      }

      // Add BP column if it doesn't exist
      const bpExists = await columnExists('Invitations', 'BP');
      if (!bpExists) {
        await queryInterface.addColumn('Invitations', 'BP', {
          type: Sequelize.JSON,
          allowNull: true,
        }, { transaction });
        console.log('Added BP column to Invitations table');
      } else {
        console.log('BP column already exists in Invitations table');
      }

      // Add territories column if it doesn't exist
      const territoriesExists = await columnExists('Invitations', 'territories');
      if (!territoriesExists) {
        await queryInterface.addColumn('Invitations', 'territories', {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: true,
        }, { transaction });
        console.log('Added territories column to Invitations table');
      } else {
        console.log('territories column already exists in Invitations table');
      }

      // Add initial_allowance column if it doesn't exist
      const initialAllowanceExists = await columnExists('Invitations', 'initial_allowance');
      if (!initialAllowanceExists) {
        await queryInterface.addColumn('Invitations', 'initial_allowance', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 5,
        }, { transaction });
        console.log('Added initial_allowance column to Invitations table');
      } else {
        console.log('initial_allowance column already exists in Invitations table');
      }

      // Add app_settings column if it doesn't exist
      const appSettingsExists = await columnExists('Invitations', 'app_settings');
      if (!appSettingsExists) {
        await queryInterface.addColumn('Invitations', 'app_settings', {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: null,
        }, { transaction });
        console.log('Added app_settings column to Invitations table');
      } else {
        console.log('app_settings column already exists in Invitations table');
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

      // Remove app_settings column if it exists
      const appSettingsExists = await columnExists('Invitations', 'app_settings');
      if (appSettingsExists) {
        await queryInterface.removeColumn('Invitations', 'app_settings', { transaction });
        console.log('Removed app_settings column from Invitations table');
      }

      // Remove initial_allowance column if it exists
      const initialAllowanceExists = await columnExists('Invitations', 'initial_allowance');
      if (initialAllowanceExists) {
        await queryInterface.removeColumn('Invitations', 'initial_allowance', { transaction });
        console.log('Removed initial_allowance column from Invitations table');
      }

      // Remove territories column if it exists
      const territoriesExists = await columnExists('Invitations', 'territories');
      if (territoriesExists) {
        await queryInterface.removeColumn('Invitations', 'territories', { transaction });
        console.log('Removed territories column from Invitations table');
      }

      // Remove BP column if it exists
      const bpExists = await columnExists('Invitations', 'BP');
      if (bpExists) {
        await queryInterface.removeColumn('Invitations', 'BP', { transaction });
        console.log('Removed BP column from Invitations table');
      }

      // Remove ICP column if it exists
      const icpExists = await columnExists('Invitations', 'ICP');
      if (icpExists) {
        await queryInterface.removeColumn('Invitations', 'ICP', { transaction });
        console.log('Removed ICP column from Invitations table');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};