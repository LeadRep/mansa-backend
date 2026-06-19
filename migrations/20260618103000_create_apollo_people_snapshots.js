"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "apollo_people_snapshots";

    try {
      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
      );
    } catch (e) {
      // ignore if extension cannot be created in current environment
    }

    const hasTable = await queryInterface
      .describeTable(tableName)
      .then(() => true)
      .catch(() => false);

    if (!hasTable) {
      await queryInterface.createTable(tableName, {
        id: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        run_id: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
        },
        external_id: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
        },
        fetched_at: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("now()"),
        },
        fetch_status: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
          defaultValue: "success",
        },
        payload_json: {
          type: Sequelize.DataTypes.JSONB,
          allowNull: true,
          defaultValue: null,
        },
        payload_hash: {
          type: Sequelize.DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
        error: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("now()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("now()"),
        },
      });
    }

    const indexes = await queryInterface.showIndex(tableName);

    const hasExternalFetchedIndex = indexes.some(
      (idx) => idx.name === "apollo_people_snapshots_external_fetched_idx"
    );
    if (!hasExternalFetchedIndex) {
      await queryInterface.addIndex(tableName, ["external_id", "fetched_at"], {
        name: "apollo_people_snapshots_external_fetched_idx",
      });
    }

    const hasRunIndex = indexes.some(
      (idx) => idx.name === "apollo_people_snapshots_run_id_idx"
    );
    if (!hasRunIndex) {
      await queryInterface.addIndex(tableName, ["run_id"], {
        name: "apollo_people_snapshots_run_id_idx",
      });
    }

    const hasRunExternalUnique = indexes.some(
      (idx) => idx.name === "apollo_people_snapshots_run_external_unique"
    );
    if (!hasRunExternalUnique) {
      await queryInterface.addIndex(tableName, ["run_id", "external_id"], {
        unique: true,
        name: "apollo_people_snapshots_run_external_unique",
      });
    }
  },

  async down(queryInterface) {
    const tableName = "apollo_people_snapshots";

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
        "apollo_people_snapshots_run_external_unique"
      );
    } catch (e) {}
    try {
      await queryInterface.removeIndex(tableName, "apollo_people_snapshots_run_id_idx");
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        tableName,
        "apollo_people_snapshots_external_fetched_idx"
      );
    } catch (e) {}

    await queryInterface.dropTable(tableName);
  },
};
