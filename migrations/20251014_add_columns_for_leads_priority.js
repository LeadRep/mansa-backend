'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const t = await queryInterface.sequelize.transaction();
        try {
            // Companies
            const companies = await queryInterface.describeTable('Companies');
            if (!companies['organization']) {
                await queryInterface.addColumn(
                    'Companies',
                    'organization',
                    { type: Sequelize.JSON, allowNull: true, defaultValue: null },
                    { transaction: t }
                );
            }
            if (!companies['is_finance']) {
                await queryInterface.addColumn(
                    'Companies',
                    'is_finance',
                    { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                    { transaction: t }
                );
            }
            if (!companies['is_esma']) {
                await queryInterface.addColumn(
                    'Companies',
                    'is_esma',
                    { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
                    { transaction: t }
                );
            }

            // GeneralLeads
            const generalLeads = await queryInterface.describeTable('GeneralLeads');
            if (!generalLeads['priority']) {
                await queryInterface.addColumn(
                    'GeneralLeads',
                    'priority',
                    { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
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
            // Companies
            const companies = await queryInterface.describeTable('Companies');
            if (companies['organization']) {
                await queryInterface.removeColumn('Companies', 'organization', { transaction: t });
            }
            if (companies['is_finance']) {
                await queryInterface.removeColumn('Companies', 'is_finance', { transaction: t });
            }
            if (companies['is_esma']) {
                await queryInterface.removeColumn('Companies', 'is_esma', { transaction: t });
            }

            // GeneralLeads
            const generalLeads = await queryInterface.describeTable('GeneralLeads');
            if (generalLeads['priority']) {
                await queryInterface.removeColumn('GeneralLeads', 'priority', { transaction: t });
            }

            await t.commit();
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }
};