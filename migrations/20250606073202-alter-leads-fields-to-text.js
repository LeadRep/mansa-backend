'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Leads', 'photo_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'linkedin_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'facebook_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'headline', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'title', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Leads', 'photo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'linkedin_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'facebook_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'headline', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'reason', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('Leads', 'title', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
