"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
      );
    } catch (e) {
      // ignore
    }

    // 1. KnowledgeSources Table
    const hasKnowledgeSources = await queryInterface
      .describeTable("KnowledgeSources")
      .then(() => true)
      .catch(() => false);

    if (!hasKnowledgeSources) {
      await queryInterface.createTable("KnowledgeSources", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        ownerType: {
          type: Sequelize.DataTypes.STRING(32),
          defaultValue: "admin",
          allowNull: false,
        },
        ownerId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
        },
        title: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: false,
        },
        type: {
          type: Sequelize.DataTypes.ENUM("text", "document", "faq", "url"),
          allowNull: false,
          defaultValue: "text",
        },
        content: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        filePath: {
          type: Sequelize.DataTypes.STRING(512),
          allowNull: true,
        },
        fileType: {
          type: Sequelize.DataTypes.STRING(64),
          allowNull: true,
        },
        fileSize: {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: true,
        },
        chunkCount: {
          type: Sequelize.DataTypes.INTEGER,
          defaultValue: 0,
        },
        tokenCount: {
          type: Sequelize.DataTypes.INTEGER,
          defaultValue: 0,
        },
        status: {
          type: Sequelize.DataTypes.ENUM("processing", "ready", "error"),
          defaultValue: "processing",
        },
        errorMessage: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        isActive: {
          type: Sequelize.DataTypes.BOOLEAN,
          defaultValue: true,
        },
        metadata: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });

      await queryInterface.addIndex("KnowledgeSources", ["ownerType", "ownerId"]);
      await queryInterface.addIndex("KnowledgeSources", ["status"]);
    }

    // 2. KnowledgeChunks Table
    const hasKnowledgeChunks = await queryInterface
      .describeTable("KnowledgeChunks")
      .then(() => true)
      .catch(() => false);

    if (!hasKnowledgeChunks) {
      await queryInterface.createTable("KnowledgeChunks", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        sourceId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
          references: {
            model: "KnowledgeSources",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        chunkIndex: {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: false,
        },
        content: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: false,
        },
        tokenCount: {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        embedding: {
          type: Sequelize.DataTypes.JSONB,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });

      await queryInterface.addIndex("KnowledgeChunks", ["sourceId"]);
      await queryInterface.addIndex("KnowledgeChunks", ["sourceId", "chunkIndex"]);
    }

    // 3. BotConfigs Table
    const hasBotConfigs = await queryInterface
      .describeTable("BotConfigs")
      .then(() => true)
      .catch(() => false);

    if (!hasBotConfigs) {
      await queryInterface.createTable("BotConfigs", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        ownerType: {
          type: Sequelize.DataTypes.STRING(32),
          defaultValue: "admin",
          allowNull: false,
        },
        ownerId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
        },
        botName: {
          type: Sequelize.DataTypes.STRING(128),
          defaultValue: "LeadRep Assistant",
          allowNull: false,
        },
        welcomeMessage: {
          type: Sequelize.DataTypes.TEXT,
          defaultValue: "Hi there! 👋 How can I help you learn about LeadRep today?",
          allowNull: false,
        },
        placeholderText: {
          type: Sequelize.DataTypes.STRING(255),
          defaultValue: "Ask anything about LeadRep...",
          allowNull: false,
        },
        themeColor: {
          type: Sequelize.DataTypes.STRING(32),
          defaultValue: "#2563EB",
          allowNull: false,
        },
        avatarUrl: {
          type: Sequelize.DataTypes.STRING(512),
          allowNull: true,
        },
        suggestedQuestions: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: [],
        },
        leadCaptureEnabled: {
          type: Sequelize.DataTypes.BOOLEAN,
          defaultValue: true,
        },
        leadCaptureTitle: {
          type: Sequelize.DataTypes.STRING(255),
          defaultValue: "Want our team to follow up with tailored insights?",
        },
        isActive: {
          type: Sequelize.DataTypes.BOOLEAN,
          defaultValue: true,
        },
        allowedDomains: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: [],
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });

      await queryInterface.addIndex("BotConfigs", ["ownerType", "ownerId"]);
    }

    // 4. PublicChatSessions Table
    const hasPublicChatSessions = await queryInterface
      .describeTable("PublicChatSessions")
      .then(() => true)
      .catch(() => false);

    if (!hasPublicChatSessions) {
      await queryInterface.createTable("PublicChatSessions", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        botConfigId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
        },
        visitorId: {
          type: Sequelize.DataTypes.STRING(128),
          allowNull: false,
        },
        visitorName: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: true,
        },
        visitorEmail: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: true,
        },
        visitorCompany: {
          type: Sequelize.DataTypes.STRING(255),
          allowNull: true,
        },
        visitorPhone: {
          type: Sequelize.DataTypes.STRING(64),
          allowNull: true,
        },
        pageUrl: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        referrer: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });

      await queryInterface.addIndex("PublicChatSessions", ["visitorId"]);
      await queryInterface.addIndex("PublicChatSessions", ["createdAt"]);
    } else {
      // Check if visitorPhone column exists
      const sessionTableInfo = await queryInterface.describeTable("PublicChatSessions");
      if (!sessionTableInfo.visitorPhone) {
        await queryInterface.addColumn("PublicChatSessions", "visitorPhone", {
          type: Sequelize.DataTypes.STRING(64),
          allowNull: true,
        });
      }
    }

    // 5. PublicChatMessages Table
    const hasPublicChatMessages = await queryInterface
      .describeTable("PublicChatMessages")
      .then(() => true)
      .catch(() => false);

    if (!hasPublicChatMessages) {
      await queryInterface.createTable("PublicChatMessages", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        sessionId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
          references: {
            model: "PublicChatSessions",
            key: "id",
          },
          onDelete: "CASCADE",
        },
        role: {
          type: Sequelize.DataTypes.ENUM("user", "assistant", "system"),
          allowNull: false,
        },
        content: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: false,
        },
        sources: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: [],
        },
        metadata: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });

      await queryInterface.addIndex("PublicChatMessages", ["sessionId"]);
      await queryInterface.addIndex("PublicChatMessages", ["createdAt"]);
    }

    // 6. UnresolvedQuestions Table
    const hasUnresolvedQuestions = await queryInterface
      .describeTable("UnresolvedQuestions")
      .then(() => true)
      .catch(() => false);

    if (!hasUnresolvedQuestions) {
      await queryInterface.createTable("UnresolvedQuestions", {
        id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        ownerType: {
          type: Sequelize.DataTypes.STRING(32),
          defaultValue: "admin",
          allowNull: false,
        },
        ownerId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
        },
        question: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: false,
        },
        frequency: {
          type: Sequelize.DataTypes.INTEGER,
          defaultValue: 1,
          allowNull: false,
        },
        status: {
          type: Sequelize.DataTypes.ENUM("pending", "resolved", "ignored"),
          defaultValue: "pending",
          allowNull: false,
        },
        suggestedAnswer: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        lastBotResponse: {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        similarityScore: {
          type: Sequelize.DataTypes.FLOAT,
          allowNull: true,
        },
        lastAskedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        resolvedSourceId: {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
        },
        visitorId: {
          type: Sequelize.DataTypes.STRING(128),
          allowNull: true,
        },
        metadata: {
          type: Sequelize.DataTypes.JSONB,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });

      await queryInterface.addIndex("UnresolvedQuestions", ["ownerType", "status"]);
      await queryInterface.addIndex("UnresolvedQuestions", ["lastAskedAt"]);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("UnresolvedQuestions").catch(() => {});
    await queryInterface.dropTable("PublicChatMessages").catch(() => {});
    await queryInterface.dropTable("PublicChatSessions").catch(() => {});
    await queryInterface.dropTable("BotConfigs").catch(() => {});
    await queryInterface.dropTable("KnowledgeChunks").catch(() => {});
    await queryInterface.dropTable("KnowledgeSources").catch(() => {});
  },
};
