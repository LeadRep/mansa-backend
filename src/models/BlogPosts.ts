import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";

export interface BlogPostAttributes {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImage?: string | null;
  authorId?: string | null;
  isPublished?: boolean;
  publishedAt?: Date | null;
}

export interface BlogPostCreationAttributes
  extends Optional<
    BlogPostAttributes,
    "id" | "excerpt" | "coverImage" | "authorId" | "isPublished" | "publishedAt"
  > {}

export class BlogPosts extends Model<
  BlogPostAttributes,
  BlogPostCreationAttributes
> {
  [x: string]: any;
}

BlogPosts.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    coverImage: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      field: "author_id",
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_published",
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "published_at",
    },
  },
  {
    sequelize: database,
    modelName: "BlogPosts",
    timestamps: true,
  }
);
