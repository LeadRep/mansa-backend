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



      // Add basic_modules column if it doesn't exist
      if (!(await columnExists('Organizations', 'basic_modules'))) {
        await queryInterface.addColumn('Organizations', 'basic_modules', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        }, { transaction });
      }

      // Add im_module column if it doesn't exist
      if (!(await columnExists('Organizations', 'im_module'))) {
        await queryInterface.addColumn('Organizations', 'im_module', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }, { transaction });
      }

      // Add demo_account column if it doesn't exist
      if (!(await columnExists('Organizations', 'demo_account'))) {
        await queryInterface.addColumn('Organizations', 'demo_account', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }, { transaction });
      }

      // Copy subscription data from Users table to Organizations (quote both identifiers and use alias)
      await queryInterface.sequelize.query(`
          UPDATE "Organizations" AS o
          SET
              plan = COALESCE(u."subscriptionName", 'Free'),
              "subscriptionStartDate" = u."subscriptionStartDate",
              "subscriptionEndDate" = u."subscriptionEndDate"
              FROM "Users" AS u
          WHERE o."organization_id" = u.organization_id
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
        'basic_modules',
        'im_module',
        'demo_account'
      ];

      for (const column of columnsToRemove) {
        if (await columnExists('Organizations', column)) {
          await queryInterface.removeColumn('Organizations', column, { transaction });
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