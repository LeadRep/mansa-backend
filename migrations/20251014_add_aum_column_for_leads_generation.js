'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('GeneralLeads');

      if (!table['aum']) {
        await queryInterface.addColumn(
          'GeneralLeads',
          'aum',
          {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null
          },
          { transaction: t }
        );
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('GeneralLeads');

      if (table['aum']) {
        await queryInterface.removeColumn('GeneralLeads', 'aum', { transaction: t });
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};