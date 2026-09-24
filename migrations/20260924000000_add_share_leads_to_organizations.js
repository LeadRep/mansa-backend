'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'Organizations';
    const definition = await queryInterface
      .describeTable(tableName)
      .then((table) => table)
      .catch(() => null);

    if (!definition) {
      return;
    }

    if (!definition.share_leads) {
      await queryInterface.addColumn(tableName, 'share_leads', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'Organizations';
    const definition = await queryInterface
      .describeTable(tableName)
      .then((table) => table)
      .catch(() => null);

    if (!definition || !definition.share_leads) {
      return;
    }

    await queryInterface.removeColumn(tableName, 'share_leads');
  },
};
