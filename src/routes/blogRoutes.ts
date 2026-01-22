import express from "express";
import { getBlogPostBySlug, listBlogPosts } from "../controllers/blogControllers/publicBlogs";

const blogRoutes = express.Router();

blogRoutes.get("/", listBlogPosts);
blogRoutes.get("/:slug", getBlogPostBySlug);

export default blogRoutes;
