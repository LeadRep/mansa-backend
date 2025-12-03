'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = 'GeneralLeads';

    // describeTable returns column metadata; catch if table missing
    const cols = await queryInterface.describeTable(tableName).catch(() => ({}));

    if (!Object.prototype.hasOwnProperty.call(cols, 'is_etf')) {
      await queryInterface.addColumn(tableName, 'is_etf', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(cols, 'is_equities')) {
      await queryInterface.addColumn(tableName, 'is_equities', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(cols, 'is_fixed_income')) {
      await queryInterface.addColumn(tableName, 'is_fixed_income', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    const tableName = 'GeneralLeads';
    const cols = await queryInterface.describeTable(tableName).catch(() => ({}));

    if (Object.prototype.hasOwnProperty.call(cols, 'is_etf')) {
      await queryInterface.removeColumn(tableName, 'is_etf');
    }

    if (Object.prototype.hasOwnProperty.call(cols, 'is_equities')) {
      await queryInterface.removeColumn(tableName, 'is_equities');
    }

    if (Object.prototype.hasOwnProperty.call(cols, 'is_fixed_income')) {
      await queryInterface.removeColumn(tableName, 'is_fixed_income');
    }
  },
};