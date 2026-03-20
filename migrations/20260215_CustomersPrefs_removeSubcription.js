// javascript
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {

      // Function to check if column exists (case-insensitive)
      const columnExists = async (tableName, columnName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT column_name FROM information_schema.columns
           WHERE LOWER(table_name) = LOWER('${tableName}')
             AND column_name = '${columnName}'
             AND table_schema = current_schema()`,
          { type: Sequelize.QueryTypes.SELECT, transaction }
        );
        return result.length > 0;
      };

      // Add subscription_name column if it doesn't exist
      if (!(await columnExists('CustomerPrefs', 'subscription_name'))) {
        await queryInterface.addColumn('CustomerPrefs', 'subscription_name', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: null,
        }, { transaction });
      }

      // Add subscription_start_date column if it doesn't exist
      if (!(await columnExists('CustomerPrefs', 'subscription_start_date'))) {
        await queryInterface.addColumn('CustomerPrefs', 'subscription_start_date', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null,
        }, { transaction });
      }

      // Add subscription_end_date column if it doesn't exist
      if (!(await columnExists('CustomerPrefs', 'subscription_end_date'))) {
        await queryInterface.addColumn('CustomerPrefs', 'subscription_end_date', {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null,
        }, { transaction });
      }

      // Add basic_modules column if it doesn't exist
      if (!(await columnExists('CustomerPrefs', 'basic_modules'))) {
        await queryInterface.addColumn('CustomerPrefs', 'basic_modules', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        }, { transaction });
      }

      // Add im_module column if it doesn't exist
      if (!(await columnExists('CustomerPrefs', 'im_module'))) {
        await queryInterface.addColumn('CustomerPrefs', 'im_module', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }, { transaction });
      }

      // Add demo_mode column if it doesn't exist
      if (!(await columnExists('CustomerPrefs', 'demo_mode'))) {
        await queryInterface.addColumn('CustomerPrefs', 'demo_mode', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }, { transaction });
      }

      // Copy subscription data from Users table to CustomerPrefs (quote both identifiers and use alias)
      await queryInterface.sequelize.query(`
          UPDATE "CustomerPrefs" AS cp
          SET
              subscription_name = u."subscriptionName",
              subscription_start_date = u."subscriptionStartDate",
              subscription_end_date = u."subscriptionEndDate"
              FROM "Users" AS u
          WHERE cp."userId" = u.id
            AND cp.subscription_name IS NULL;
      `, { transaction });

      await transaction.commit();
      console.log('Migration completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Function to check if column exists (case-insensitive)
      const columnExists = async (tableName, columnName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT column_name FROM information_schema.columns
           WHERE LOWER(table_name) = LOWER('${tableName}')
             AND column_name = '${columnName}'
             AND table_schema = current_schema()`,
          { type: Sequelize.QueryTypes.SELECT, transaction }
        );
        return result.length > 0;
      };

      // Remove columns if they exist
      const columnsToRemove = [
        'subscription_name',
        'subscription_start_date',
        'subscription_end_date',
        'basic_modules',
        'im_module',
        'demo_mode'
      ];

      for (const column of columnsToRemove) {
        if (await columnExists('CustomerPrefs', column)) {
          await queryInterface.removeColumn('CustomerPrefs', column, { transaction });
        }
      }

      await transaction.commit();
      console.log('Migration rollback completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
};