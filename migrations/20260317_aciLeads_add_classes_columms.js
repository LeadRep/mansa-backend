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

      // Add priority column if it doesn't exist
      if (!(await columnExists('aci_leads', 'priority'))) {
        await queryInterface.addColumn('aci_leads', 'priority', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 0,
        }, { transaction });
      }

      // Add is_lead_etf column if it doesn't exist
      if (!(await columnExists('aci_leads', 'is_lead_etf'))) {
        await queryInterface.addColumn('aci_leads', 'is_lead_etf', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        }, { transaction });
      }

      // Add is_lead_equities column if it doesn't exist
      if (!(await columnExists('aci_leads', 'is_lead_equities'))) {
        await queryInterface.addColumn('aci_leads', 'is_lead_equities', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        }, { transaction });
      }

      // Add is_lead_fixed_income column if it doesn't exist
      if (!(await columnExists('aci_leads', 'is_lead_fixed_income'))) {
        await queryInterface.addColumn('aci_leads', 'is_lead_fixed_income', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        }, { transaction });
      }

      // Add is_lead_alternatives column if it doesn't exist
      if (!(await columnExists('aci_leads', 'is_lead_alternatives'))) {
        await queryInterface.addColumn('aci_leads', 'is_lead_alternatives', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        }, { transaction });
      }

      // Add is_lead_multi_asset column if it doesn't exist
      if (!(await columnExists('aci_leads', 'is_lead_multi_asset'))) {
        await queryInterface.addColumn('aci_leads', 'is_lead_multi_asset', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        }, { transaction });
      }

      // Add is_lead_digital_assets column if it doesn't exist
      if (!(await columnExists('aci_leads', 'is_lead_digital_assets'))) {
        await queryInterface.addColumn('aci_leads', 'is_lead_digital_assets', {
          type: Sequelize.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        }, { transaction });
      }

      // Add individual_segments column if it doesn't exist
      if (!(await columnExists('aci_leads', 'individual_segments'))) {
        await queryInterface.addColumn('aci_leads', 'individual_segments', {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: null,
        }, { transaction });
      }

      await transaction.commit();
      console.log('ACILeads migration completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('ACILeads migration failed:', error);
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

      // Remove columns if they exist
      const columnsToRemove = [
        'is_lead_etf',
        'is_lead_equities',
        'is_lead_fixed_income',
        'is_lead_alternatives',
        'is_lead_multi_asset',
        'is_lead_digital_assets'
      ];

      for (const column of columnsToRemove) {
        if (await columnExists('aci_leads', column)) {
          await queryInterface.removeColumn('aci_leads', column, { transaction });
        }
      }

      await transaction.commit();
      console.log('ACILeads migration rollback completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('ACILeads migration rollback failed:', error);
      throw error;
    }
  }
};