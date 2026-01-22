"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
      );
    } catch (e) {
      // ignore if not Postgres or no permissions
    }

    const hasTable = await queryInterface
      .describeTable("BlogPosts")
      .then(() => true)
      .catch(() => false);

    if (!hasTable) {
      await queryInterface.createTable("BlogPosts", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        title: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
        },
        slug: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        excerpt: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        content: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: false,
        },
        coverImage: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        author_id: {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
        },
        is_published: {
          type: Sequelize.DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        published_at: {
          type: Sequelize.DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("now()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("now()"),
        },
      });

      await queryInterface.addIndex("BlogPosts", ["slug"], {
        unique: true,
        name: "blog_posts_slug_uniq",
      });
      await queryInterface.addIndex("BlogPosts", ["createdAt"], {
        name: "blog_posts_created_at_idx",
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex("BlogPosts", "blog_posts_slug_uniq");
    } catch (e) {}
    try {
      await queryInterface.removeIndex("BlogPosts", "blog_posts_created_at_idx");
    } catch (e) {}
    await queryInterface.dropTable("BlogPosts");
  },
};
