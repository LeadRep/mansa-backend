'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = 'GeneralLeads';

    // describeTable returns column metadata; catch if table missing
    const cols = await queryInterface.describeTable(tableName).catch(() => ({}));

    if (!Object.prototype.hasOwnProperty.call(cols, 'hidden')) {
      await queryInterface.addColumn(tableName, 'hidden', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    const tableName = 'GeneralLeads';
    const cols = await queryInterface.describeTable(tableName).catch(() => ({}));

    if (Object.prototype.hasOwnProperty.call(cols, 'hidden')) {
      await queryInterface.removeColumn(tableName, 'hidden');
    }
  },
};