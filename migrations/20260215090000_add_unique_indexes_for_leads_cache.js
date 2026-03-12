'use strict';

module.exports = {
  async up(queryInterface) {
    const ensureIndex = async (table, name, fields, options = {}) => {
      const indexes = await queryInterface.showIndex(table);
      const exists = indexes.some((idx) => idx.name === name);
      if (!exists) {
        await queryInterface.addIndex(table, fields, {
          name,
          unique: true,
          ...options,
        });
      }
    };

    // await ensureIndex('Leads', 'leads_owner_external_unique', ['owner_id', 'external_id']);
    // await ensureIndex('GeneralLeads', 'general_leads_external_unique', ['external_id']);
    // await ensureIndex('Companies', 'companies_external_unique', ['external_id']);
  },

  async down(queryInterface) {
    const dropIndex = async (table, name) => {
      const indexes = await queryInterface.showIndex(table);
      const exists = indexes.some((idx) => idx.name === name);
      if (exists) {
        await queryInterface.removeIndex(table, name);
      }
    };

    await dropIndex('Leads', 'leads_owner_external_unique');
    await dropIndex('GeneralLeads', 'general_leads_external_unique');
    await dropIndex('Companies', 'companies_external_unique');
  },
};
