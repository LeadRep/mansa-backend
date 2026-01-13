"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add last_seen to Users table
    await queryInterface.addColumn("Users", "last_seen", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Create AnalyticsEvent table
    await queryInterface.createTable("AnalyticsEvent", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      event_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("AnalyticsEvent");
    await queryInterface.removeColumn("Users", "last_seen");
  },
};
