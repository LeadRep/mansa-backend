"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Leads", "status", {
      type: Sequelize.ENUM("new", "saved", "deleted"),
      defaultValue: "new",
      allowNull: false,
    });

    await queryInterface.addColumn("CustomerPrefs", "leadsGenerationStatus", {
      type: Sequelize.ENUM("not_started", "ongoing", "completed", "failed"),
      defaultValue: "completed",
      allowNull: false,
    });
    await queryInterface.addColumn("CustomerPrefs", "refreshLeads", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 5,
    });
    await queryInterface.addColumn("CustomerPrefs", "nextRefresh", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Leads", "status");

    await queryInterface.removeColumn("CustomerPrefs", "leadsGenerationStatus");
    await queryInterface.removeColumn("CustomerPrefs", "refreshLeads");
    await queryInterface.removeColumn("CustomerPrefs", "nextRefresh");
  },
};
