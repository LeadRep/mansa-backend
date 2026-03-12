'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const leadsTable = await queryInterface.describeTable('Leads');
    const archivedLeadsTable = await queryInterface.describeTable('ArchivedSharedLeads');

    if (!leadsTable.intro_mail) {
      await queryInterface.addColumn('Leads', 'intro_mail', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!archivedLeadsTable.intro_mail) {
      await queryInterface.addColumn('ArchivedSharedLeads', 'intro_mail', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const leadsTable = await queryInterface.describeTable('Leads');
    const archivedLeadsTable = await queryInterface.describeTable('ArchivedSharedLeads');

    if (leadsTable.intro_mail) {
      await queryInterface.removeColumn('Leads', 'intro_mail');
    }

    if (archivedLeadsTable.intro_mail) {
      await queryInterface.removeColumn('ArchivedSharedLeads', 'intro_mail');
    }
  },
};
