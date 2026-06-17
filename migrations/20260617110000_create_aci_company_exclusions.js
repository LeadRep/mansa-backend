"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "ACICompanyExclusions";

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

    if (hasTable) {
      return;
    }

    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      organizationId: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
      },
      companyId: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
      },
      excludedByUserId: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
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

    await queryInterface.addConstraint(tableName, {
      fields: ["organizationId", "companyId"],
      type: "unique",
      name: "aci_company_exclusions_org_company_unique",
    });

    await queryInterface.addIndex(tableName, ["organizationId"], {
      name: "aci_company_exclusions_org_idx",
    });

    await queryInterface.addIndex(tableName, ["companyId"], {
      name: "aci_company_exclusions_company_idx",
    });

    await queryInterface.addIndex(tableName, ["excludedByUserId"], {
      name: "aci_company_exclusions_excluded_by_user_idx",
    });
  },

  async down(queryInterface) {
    const tableName = "ACICompanyExclusions";

    const hasTable = await queryInterface
      .describeTable(tableName)
      .then(() => true)
      .catch(() => false);

    if (!hasTable) {
      return;
    }

    try {
      await queryInterface.removeIndex(tableName, "aci_company_exclusions_org_idx");
    } catch (e) {}
    try {
      await queryInterface.removeIndex(tableName, "aci_company_exclusions_company_idx");
    } catch (e) {}
    try {
      await queryInterface.removeIndex(
        tableName,
        "aci_company_exclusions_excluded_by_user_idx"
      );
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        tableName,
        "aci_company_exclusions_org_company_unique"
      );
    } catch (e) {}

    await queryInterface.dropTable(tableName);
  },
};
