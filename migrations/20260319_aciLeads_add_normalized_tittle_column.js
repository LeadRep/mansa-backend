'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const columnExists = async (tableName, columnName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT column_name FROM information_schema.columns
           WHERE LOWER(table_name) = LOWER($1)
             AND column_name = $2
             AND table_schema = current_schema()`,
          {
            bind: [tableName, columnName],
            type: Sequelize.QueryTypes.SELECT,
            transaction,
          }
        );
        return result.length > 0;
      };

      const indexExists = async (indexName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT indexname FROM pg_indexes 
           WHERE indexname = $1 
           AND schemaname = current_schema()`,
          {
            bind: [indexName],
            type: Sequelize.QueryTypes.SELECT,
            transaction,
          }
        );
        return result.length > 0;
      };

      const tableName = 'aci_leads';

      // Add normalized_title column if it doesn't exist
      if (!(await columnExists(tableName, 'normalized_title'))) {
        await queryInterface.addColumn(
          tableName,
          'normalized_title',
          {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
        console.log('Added normalized_title column to aci_leads table');
      }

      // Create partial index on normalized_title where it's not null
      const normalizedTitleIndexName = 'idx_aci_leads_normalized_title';
      if (!(await indexExists(normalizedTitleIndexName))) {
        await queryInterface.sequelize.query(
          `CREATE INDEX ${normalizedTitleIndexName} ON aci_leads(normalized_title) WHERE normalized_title IS NOT NULL`,
          { transaction }
        );
        console.log('Created index idx_aci_leads_normalized_title');
      }

      // Create partial index on title where normalized_title is null
      const titleFallbackIndexName = 'idx_aci_leads_title_fallback';
      if (!(await indexExists(titleFallbackIndexName))) {
        await queryInterface.sequelize.query(
          `CREATE INDEX ${titleFallbackIndexName} ON aci_leads(title) WHERE normalized_title IS NULL`,
          { transaction }
        );
        console.log('Created index idx_aci_leads_title_fallback');
      }

      await transaction.commit();
      console.log('Migration up: successfully added normalized_title column and indexes');
    } catch (err) {
      await transaction.rollback();
      console.error('Migration up failed:', err);
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const columnExists = async (tableName, columnName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT column_name FROM information_schema.columns
           WHERE LOWER(table_name) = LOWER($1)
             AND column_name = $2
             AND table_schema = current_schema()`,
          {
            bind: [tableName, columnName],
            type: Sequelize.QueryTypes.SELECT,
            transaction,
          }
        );
        return result.length > 0;
      };

      const indexExists = async (indexName) => {
        const result = await queryInterface.sequelize.query(
          `SELECT indexname FROM pg_indexes 
           WHERE indexname = $1 
           AND schemaname = current_schema()`,
          {
            bind: [indexName],
            type: Sequelize.QueryTypes.SELECT,
            transaction,
          }
        );
        return result.length > 0;
      };

      const tableName = 'aci_leads';

      // Drop indexes first
      const titleFallbackIndexName = 'idx_aci_leads_title_fallback';
      if (await indexExists(titleFallbackIndexName)) {
        await queryInterface.sequelize.query(
          `DROP INDEX ${titleFallbackIndexName}`,
          { transaction }
        );
        console.log('Dropped index idx_aci_leads_title_fallback');
      }

      const normalizedTitleIndexName = 'idx_aci_leads_normalized_title';
      if (await indexExists(normalizedTitleIndexName)) {
        await queryInterface.sequelize.query(
          `DROP INDEX ${normalizedTitleIndexName}`,
          { transaction }
        );
        console.log('Dropped index idx_aci_leads_normalized_title');
      }

      // Remove normalized_title column if it exists
      if (await columnExists(tableName, 'normalized_title')) {
        await queryInterface.removeColumn(tableName, 'normalized_title', { transaction });
        console.log('Removed normalized_title column from aci_leads table');
      }

      await transaction.commit();
      console.log('Migration down: successfully removed normalized_title column and indexes');
    } catch (err) {
      await transaction.rollback();
      console.error('Migration down failed:', err);
      throw err;
    }
  },
};