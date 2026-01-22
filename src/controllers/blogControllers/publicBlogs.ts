import { Request, Response } from "express";
import { BlogPosts } from "../../models/BlogPosts";
import { buildExcerpt } from "./utils";

export const listBlogPosts = async (request: Request, response: Response) => {
  try {
    const posts = await BlogPosts.findAll({
      where: { isPublished: true },
      order: [["createdAt", "DESC"]],
    });

    const data = posts.map((post: any) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || buildExcerpt(post.content),
      coverImage: post.coverImage,
      publishedAt: post.publishedAt || post.createdAt,
    }));

    return response.json({
      status: "success",
      data,
    });
  } catch (error: any) {
    return response.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getBlogPostBySlug = async (
  request: Request,
  response: Response
) => {
  try {
    const { slug } = request.params;
    const post = await BlogPosts.findOne({
      where: { slug, isPublished: true },
    });
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
