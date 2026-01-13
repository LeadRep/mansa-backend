'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Companies');
    const addIfMissing = async (name, spec) => {
      if (!table[name]) {
        await queryInterface.addColumn('Companies', name, spec);
      }
    };

    await addIfMissing('industry', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    // await addIfMissing('industries', { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true, defaultValue: null });
    await addIfMissing('secondary_industries', { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true, defaultValue: null });
    await addIfMissing('keywords', { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true, defaultValue: null });
    await addIfMissing('estimated_num_employees', { type: Sequelize.INTEGER, allowNull: true, defaultValue: null });
    await addIfMissing('snippets_loaded', { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: null });
    await addIfMissing('industry_tag_id', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await addIfMissing('industry_tag_hash', { type: Sequelize.JSON, allowNull: true, defaultValue: null });
    await addIfMissing('retail_location_count', { type: Sequelize.INTEGER, allowNull: true, defaultValue: null });
    await addIfMissing('raw_address', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await addIfMissing('street_address', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await addIfMissing('city', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await addIfMissing('state', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await addIfMissing('postal_code', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await addIfMissing('country', { type: Sequelize.STRING, allowNull: true, defaultValue: null });
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Companies');
    const removeIfExists = async (name) => {
      if (table[name]) {
        await queryInterface.removeColumn('Companies', name);
      }
    };

    await removeIfExists('industry');
    await removeIfExists('industries');
    await removeIfExists('secondary_industries');
    await removeIfExists('keywords');
    await removeIfExists('estimated_num_employees');
    await removeIfExists('snippets_loaded');
    await removeIfExists('industry_tag_id');
    await removeIfExists('industry_tag_hash');
    await removeIfExists('retail_location_count');
    await removeIfExists('raw_address');
    await removeIfExists('street_address');
    await removeIfExists('city');
    await removeIfExists('state');
    await removeIfExists('postal_code');
    await removeIfExists('country');
  },
};

