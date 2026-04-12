// migrations/YYYYMMDD_add_aci_companies_columns.js
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

      // Add aum column if it doesn't exist
      if (!(await columnExists('aci_companies', 'aum'))) {
        await queryInterface.addColumn(
          'aci_companies',
          'aum',
          {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
        console.log('Added aum column to aci_companies');
      } else {
        console.log('aum column already exists in aci_companies');
      }

      // Add organization column (mapped to raw_data field) if it doesn't exist
      if (!(await columnExists('aci_companies', 'organization'))) {
        await queryInterface.addColumn(
          'aci_companies',
          'organization',
          {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
        console.log('Added organization column to aci_companies');
      } else {
        console.log('organization column already exists in aci_companies');
      }

      // Add is_etf column if it doesn't exist
      if (!(await columnExists('aci_companies', 'is_etf'))) {
        await queryInterface.addColumn(
          'aci_companies',
          'is_etf',
          {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: false,
          },
          { transaction }
        );
        console.log('Added is_etf column to aci_companies');
      } else {
        console.log('is_etf column already exists in aci_companies');
      }

      // Add is_equities column if it doesn't exist
      if (!(await columnExists('aci_companies', 'is_equities'))) {
        await queryInterface.addColumn(
          'aci_companies',
          'is_equities',
          {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: false,
          },
          { transaction }
        );
        console.log('Added is_equities column to aci_companies');
      } else {
        console.log('is_equities column already exists in aci_companies');
      }

      // Add is_fixed_income column if it doesn't exist
      if (!(await columnExists('aci_companies', 'is_fixed_income'))) {
        await queryInterface.addColumn(
          'aci_companies',
          'is_fixed_income',
          {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: false,
          },
          { transaction }
        );
        console.log('Added is_fixed_income column to aci_companies');
      } else {
        console.log('is_fixed_income column already exists in aci_companies');
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

      // Remove columns in reverse order
      if (await columnExists('aci_companies', 'is_fixed_income')) {
        await queryInterface.removeColumn('aci_companies', 'is_fixed_income', { transaction });
        console.log('Removed is_fixed_income column from aci_companies');
      }

      if (await columnExists('aci_companies', 'is_equities')) {
        await queryInterface.removeColumn('aci_companies', 'is_equities', { transaction });
        console.log('Removed is_equities column from aci_companies');
      }

      if (await columnExists('aci_companies', 'is_etf')) {
        await queryInterface.removeColumn('aci_companies', 'is_etf', { transaction });
        console.log('Removed is_etf column from aci_companies');
      }

      if (await columnExists('aci_companies', 'organization')) {
        await queryInterface.removeColumn('aci_companies', 'organization', { transaction });
        console.log('Removed organization column from aci_companies');
      }

      if (await columnExists('aci_companies', 'aum')) {
        await queryInterface.removeColumn('aci_companies', 'aum', { transaction });
        console.log('Removed aum column from aci_companies');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};