'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('GeneralLeads');

      if (!table['individual_segments']) {
        await queryInterface.addColumn(
          'GeneralLeads',
          'individual_segments',
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

      if (table['individual_segments']) {
        await queryInterface.removeColumn('GeneralLeads', 'individual_segments', { transaction: t });
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};