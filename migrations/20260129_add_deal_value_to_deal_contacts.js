"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface
      .describeTable("DealContacts")
      .then((def) => def)
      .catch(() => null);

    if (table && !table.deal_value) {
      await queryInterface.addColumn("DealContacts", "deal_value", {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface
      .describeTable("DealContacts")
      .then((def) => def)
      .catch(() => null);

    if (table && table.deal_value) {
      await queryInterface.removeColumn("DealContacts", "deal_value");
    }
  },
};
