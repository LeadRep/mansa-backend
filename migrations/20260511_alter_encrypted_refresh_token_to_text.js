'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('UserLinkedAccountsToken');

    if (table.encrypted_refresh_token.type !== 'TEXT') {
      await queryInterface.changeColumn('UserLinkedAccountsToken', 'encrypted_refresh_token', {
        type: Sequelize.TEXT,
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('UserLinkedAccountsToken');

    if (table.encrypted_refresh_token.type === 'TEXT') {
      await queryInterface.changeColumn('UserLinkedAccountsToken', 'encrypted_refresh_token', {
        type: Sequelize.STRING(255),
        allowNull: false,
      });
    }
  },
};
