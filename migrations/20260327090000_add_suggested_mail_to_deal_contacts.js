'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('DealContacts');

    if (!table.suggested_mail) {
      await queryInterface.addColumn('DealContacts', 'suggested_mail', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('DealContacts');

    if (table.suggested_mail) {
      await queryInterface.removeColumn('DealContacts', 'suggested_mail');
    }
  },
};
