"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Leads", "status", {
      type: Sequelize.STRING,
      defaultValue: "new",
      allowNull: false,
    });
    await queryInterface.addColumn("CustomerPrefs", "aiQueryParams", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("CustomerPrefs", "totalPages", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn("CustomerPrefs", "currentPage", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn("CustomerPrefs", "prompt", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("Leads", "views", {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      allowNull: false,
    });
  },

  async down(queryInterface) {},
};
