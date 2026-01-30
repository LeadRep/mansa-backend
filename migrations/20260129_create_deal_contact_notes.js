"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
      );
    } catch (e) {
      // ignore if not Postgres or no permissions
    }

    const hasTable = await queryInterface
      .describeTable("DealContactNotes")
      .then(() => true)
      .catch(() => false);

    if (!hasTable) {
      await queryInterface.createTable("DealContactNotes", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        deal_contact_id: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
        },
        owner_id: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
        },
        comment: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        file_url: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        file_name: {
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

      await queryInterface.addIndex("DealContactNotes", ["deal_contact_id"], {
        name: "deal_contact_notes_contact_idx",
      });
      await queryInterface.addIndex("DealContactNotes", ["owner_id"], {
        name: "deal_contact_notes_owner_idx",
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        "DealContactNotes",
        "deal_contact_notes_contact_idx"
      );
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        "DealContactNotes",
        "deal_contact_notes_owner_idx"
      );
    } catch (e) {}
    await queryInterface.dropTable("DealContactNotes");
  },
};
