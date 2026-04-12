// migrations/YYYYMMDD_add_is_lead_none_identified_to_aci_leads.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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

      // Add is_lead_none_identified column if it doesn't exist
      if (!(await columnExists('aci_leads', 'is_lead_none_identified'))) {
        await queryInterface.addColumn(
          'aci_leads',
          'is_lead_none_identified',
          {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: true,
          },
          { transaction }
        );
        console.log('Added is_lead_none_identified column to aci_leads');
      } else {
        console.log('is_lead_none_identified column already exists in aci_leads');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
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

      // Remove is_lead_none_identified column if it exists
      if (await columnExists('aci_leads', 'is_lead_none_identified')) {
        await queryInterface.removeColumn('aci_leads', 'is_lead_none_identified', { transaction });
        console.log('Removed is_lead_none_identified column from aci_leads');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};