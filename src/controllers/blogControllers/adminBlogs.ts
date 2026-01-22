import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { BlogPosts } from "../../models/BlogPosts";
import { buildExcerpt, slugifyTitle } from "./utils";

const getExtension = (file: Express.Multer.File) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext) {
    return ext;
  }
  const mime = file.mimetype || "";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/svg+xml") return ".svg";
  return "";
};

const ensureUploadDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const normalizeCoverImage = (coverImage?: string | null) => {
  if (!coverImage) return coverImage;
  if (!coverImage.startsWith("/uploads/blogs/")) return coverImage;
  const filename = path.basename(coverImage);
  if (path.extname(filename)) {
    return coverImage;
  }
  const uploadDir = path.join(__dirname, "../../../uploads/blogs");
  if (!fs.existsSync(uploadDir)) {
    return coverImage;
  }
  const match = fs
    .readdirSync(uploadDir)
    .find((entry) => entry.startsWith(`${filename}.`));
  return match ? `/uploads/blogs/${match}` : coverImage;
};

const buildSlug = async (title: string, existingId?: string) => {
  const base = slugifyTitle(title);
  let slug = base;
  let suffix = 1;
  // Ensure uniqueness
  while (true) {
    const existing = await BlogPosts.findOne({ where: { slug } });
    if (!existing || (existingId && existing.id === existingId)) {
      return slug;
    }
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
};

export const createBlogPost = async (request: Request, response: Response) => {
  try {
    const { title, content, coverImage, isPublished } = request.body;
    if (!title || !content) {
      return response.status(400).json({
        status: "error",
        message: "Title and content are required",
      });
    }

    const slug = await buildSlug(title);
    const authorId = request.user?.id ?? null;
    const computedExcerpt = buildExcerpt(content);
    const publishedAt = isPublished === false ? null : new Date();
    const normalizedCover = normalizeCoverImage(coverImage);

    const post = await BlogPosts.create({
      title,
      slug,
      content,
      excerpt: computedExcerpt,
      coverImage: normalizedCover || null,
      authorId,
      isPublished: isPublished !== false,
      publishedAt,
    });

    return response.status(201).json({
      status: "success",
      data: post,
    });
  } catch (error: any) {
    return response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const updateBlogPost = async (request: Request, response: Response) => {
  try {
    const { id } = request.params;
    const { title, content, coverImage, isPublished, slug } =
      request.body;

    const post = await BlogPosts.findByPk(id);
    if (!post) {
      return response.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    if (title) {
      post.title = title;
      post.slug = slug ? slugifyTitle(slug) : await buildSlug(title, post.id);
    } else if (slug) {
      post.slug = slugifyTitle(slug);
    }

    if (content) {
      post.content = content;
      post.excerpt = buildExcerpt(content);
    }

    if (coverImage !== undefined) {
      post.coverImage = normalizeCoverImage(coverImage) || null;
    }

    if (isPublished !== undefined) {
      post.isPublished = Boolean(isPublished);
      post.publishedAt = post.isPublished ? new Date() : null;
    }

    await post.save();

    return response.json({
      status: "success",
      data: post,
    });
  } catch (error: any) {
    return response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const deleteBlogPost = async (request: Request, response: Response) => {
  try {
    const { id } = request.params;
    const post = await BlogPosts.findByPk(id);
    if (!post) {
      return response.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }

    await post.destroy();
    return response.json({ status: "success" });
  } catch (error: any) {
    return response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const listBlogPostsAdmin = async (
  request: Request,
  response: Response
) => {
  try {
    const posts = await BlogPosts.findAll({
      order: [["createdAt", "DESC"]],
    });
    return response.json({
      status: "success",
      data: posts,
    });
  } catch (error: any) {
    return response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getBlogPostAdmin = async (
  request: Request,
  response: Response
) => {
  try {
    const { id } = request.params;
    const post = await BlogPosts.findByPk(id);
    if (!post) {
      return response.status(404).json({
        status: "error",
        message: "Post not found",
      });
    }
    return response.json({
      status: "success",
      data: post,
    });
  } catch (error: any) {
    return response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const uploadBlogImage = async (
  request: Request,
  response: Response
) => {
  try {
    if (!request.file) {
      return response.status(400).json({
        status: "error",
        message: "File is required",
      });
    }

    const uploadDir = path.join(__dirname, "../../../uploads/blogs");
    ensureUploadDir(uploadDir);

    const extension = getExtension(request.file);
    const filename = `${request.file.filename}${extension}`;
    const filePath = path.join(uploadDir, filename);
    fs.renameSync(request.file.path, filePath);

    const publicPath = `/uploads/blogs/${filename}`;

    return response.json({
      status: "success",
      data: { url: publicPath },
    });
  } catch (error: any) {
    return response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
