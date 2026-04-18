'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Companies');
    const addIfMissing = async (name, spec) => {
      if (!table[name]) {
        await queryInterface.addColumn('Companies', name, spec);
      }
    };

    await addIfMissing('short_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addIfMissing('departmental_head_count', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Companies');
    const removeIfExists = async (name) => {
      if (table[name]) {
        await queryInterface.removeColumn('Companies', name);
      }
    };

    await removeIfExists('short_description');
    await removeIfExists('departmental_head_count');
  },
};
