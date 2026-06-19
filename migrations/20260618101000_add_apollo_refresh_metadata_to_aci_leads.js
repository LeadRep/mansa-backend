"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "aci_leads";

    const hasTable = await queryInterface
      .describeTable(tableName)
      .then(() => true)
      .catch(() => false);

    if (!hasTable) {
      return;
    }

    const definition = await queryInterface.describeTable(tableName);

    if (!definition.apollo_last_refreshed_at) {
      await queryInterface.addColumn(tableName, "apollo_last_refreshed_at", {
        type: Sequelize.DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!definition.apollo_last_payload_hash) {
      await queryInterface.addColumn(tableName, "apollo_last_payload_hash", {
        type: Sequelize.DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!definition.apollo_refresh_status) {
      await queryInterface.addColumn(tableName, "apollo_refresh_status", {
        type: Sequelize.DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!definition.apollo_refresh_error) {
      await queryInterface.addColumn(tableName, "apollo_refresh_error", {
        type: Sequelize.DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      });
    }

    const indexes = await queryInterface.showIndex(tableName);

    const hasExternalIdIndex = indexes.some(
      (idx) => idx.name === "aci_leads_external_id_idx"
    );
    if (!hasExternalIdIndex) {
      await queryInterface.addIndex(tableName, ["external_id"], {
        name: "aci_leads_external_id_idx",
      });
    }

    const hasRefreshedAtIndex = indexes.some(
      (idx) => idx.name === "aci_leads_apollo_last_refreshed_at_idx"
    );
    if (!hasRefreshedAtIndex) {
      await queryInterface.addIndex(tableName, ["apollo_last_refreshed_at"], {
        name: "aci_leads_apollo_last_refreshed_at_idx",
      });
    }
  },

  async down(queryInterface) {
    const tableName = "aci_leads";

    const hasTable = await queryInterface
      .describeTable(tableName)
      .then(() => true)
      .catch(() => false);

    if (!hasTable) {
      return;
    }

    try {
      await queryInterface.removeIndex(
        tableName,
        "aci_leads_apollo_last_refreshed_at_idx"
      );
    } catch (e) {}

    try {
      await queryInterface.removeIndex(tableName, "aci_leads_external_id_idx");
    } catch (e) {}

    const definition = await queryInterface.describeTable(tableName);

    if (definition.apollo_refresh_error) {
      await queryInterface.removeColumn(tableName, "apollo_refresh_error");
    }
    if (definition.apollo_refresh_status) {
      await queryInterface.removeColumn(tableName, "apollo_refresh_status");
    }
    if (definition.apollo_last_payload_hash) {
      await queryInterface.removeColumn(tableName, "apollo_last_payload_hash");
    }
    if (definition.apollo_last_refreshed_at) {
      await queryInterface.removeColumn(tableName, "apollo_last_refreshed_at");
    }
  },
};
