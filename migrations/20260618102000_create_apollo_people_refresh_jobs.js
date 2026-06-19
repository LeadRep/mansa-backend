"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "apollo_people_refresh_jobs";

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
        status: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
          defaultValue: "pending",
        },
        attempts: {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        next_retry_at: {
          type: Sequelize.DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
        requested_by: {
          type: Sequelize.DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
        },
        error: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        started_at: {
          type: Sequelize.DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
        finished_at: {
          type: Sequelize.DataTypes.DATE,
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

    const hasRunExternalUnique = indexes.some(
      (idx) => idx.name === "apollo_people_refresh_jobs_run_external_unique"
    );
    if (!hasRunExternalUnique) {
      await queryInterface.addIndex(tableName, ["run_id", "external_id"], {
        unique: true,
        name: "apollo_people_refresh_jobs_run_external_unique",
      });
    }

    const hasStatusNextRetryIndex = indexes.some(
      (idx) => idx.name === "apollo_people_refresh_jobs_status_next_retry_idx"
    );
    if (!hasStatusNextRetryIndex) {
      await queryInterface.addIndex(tableName, ["status", "next_retry_at"], {
        name: "apollo_people_refresh_jobs_status_next_retry_idx",
      });
    }

    const hasRunStatusIndex = indexes.some(
      (idx) => idx.name === "apollo_people_refresh_jobs_run_status_idx"
    );
    if (!hasRunStatusIndex) {
      await queryInterface.addIndex(tableName, ["run_id", "status"], {
        name: "apollo_people_refresh_jobs_run_status_idx",
      });
    }

    const hasExternalIdIndex = indexes.some(
      (idx) => idx.name === "apollo_people_refresh_jobs_external_id_idx"
    );
    if (!hasExternalIdIndex) {
      await queryInterface.addIndex(tableName, ["external_id"], {
        name: "apollo_people_refresh_jobs_external_id_idx",
      });
    }
  },

  async down(queryInterface) {
    const tableName = "apollo_people_refresh_jobs";

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
        "apollo_people_refresh_jobs_external_id_idx"
      );
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        tableName,
        "apollo_people_refresh_jobs_run_status_idx"
      );
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        tableName,
        "apollo_people_refresh_jobs_status_next_retry_idx"
      );
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        tableName,
        "apollo_people_refresh_jobs_run_external_unique"
      );
    } catch (e) {}

    await queryInterface.dropTable(tableName);
  },
};
