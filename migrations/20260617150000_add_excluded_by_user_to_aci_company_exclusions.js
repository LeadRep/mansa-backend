"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "ACICompanyExclusions";

    const hasTable = await queryInterface
      .describeTable(tableName)
      .then(() => true)
      .catch(() => false);

    if (!hasTable) {
      return;
    }

    const definition = await queryInterface.describeTable(tableName);
    if (!definition.excludedByUserId) {
      await queryInterface.addColumn(tableName, "excludedByUserId", {
        type: Sequelize.DataTypes.UUID,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex(tableName);
    const hasIndex = indexes.some(
      (idx) => idx.name === "aci_company_exclusions_excluded_by_user_idx"
    );

    if (!hasIndex) {
      await queryInterface.addIndex(tableName, ["excludedByUserId"], {
        name: "aci_company_exclusions_excluded_by_user_idx",
      });
    }
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
      await queryInterface.removeIndex(
        tableName,
        "aci_company_exclusions_excluded_by_user_idx"
      );
    } catch (e) {}

    const definition = await queryInterface.describeTable(tableName);
    if (definition.excludedByUserId) {
      await queryInterface.removeColumn(tableName, "excludedByUserId");
    }
  },
};
