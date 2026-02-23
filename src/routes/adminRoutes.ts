import express from "express";
import { adminAuth } from "../middlewares/adminAuth";
import {
  getAllUsers,
  getUserDetails,
  updateUser,
  updateCustomerPref,
  createAdmin,
} from "../controllers/adminControllers/users";
import { getGeneralLeads } from "../controllers/adminControllers/leads";
import { getCompanies } from "../controllers/adminControllers/companies";
import {
  getMrr,
  getArr,
  getUserMetrics,
  getSubscribedUsers,
  getGeo,
  getActiveUsersByOrg,
} from "../controllers/adminControllers/analytics";
import path from "path";
import fs from "fs";
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import {
  createBlogPost,
  deleteBlogPost,
  listBlogPostsAdmin,
  updateBlogPost,
  uploadBlogImage,
  getBlogPostAdmin,
} from "../controllers/blogControllers/adminBlogs";

const adminRoutes = express.Router();
const uploadTempDir = path.join(__dirname, "../../uploads/tmp");
if (!fs.existsSync(uploadTempDir)) {
  fs.mkdirSync(uploadTempDir, { recursive: true });
}

const upload = multer({
  dest: uploadTempDir,
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    return cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Public Admin Routes (for initial setup)
adminRoutes.post("/create", createAdmin);

// Apply adminAuth middleware to all admin routes
adminRoutes.use(adminAuth);

// User Routes
adminRoutes.get("/users", getAllUsers);
adminRoutes.get("/users/:id", getUserDetails);
adminRoutes.put("/users/:id", updateUser);
adminRoutes.put("/users/:userId/preferences", updateCustomerPref);

// Leads Routes
adminRoutes.get("/leads", getGeneralLeads);

// Companies Routes
adminRoutes.get("/companies", getCompanies);

// Analytics Routes
adminRoutes.get("/analytics/mrr", getMrr);
adminRoutes.get("/analytics/arr", getArr);
adminRoutes.get("/analytics/users", getUserMetrics);
adminRoutes.get("/analytics/subscribed", getSubscribedUsers);
adminRoutes.get("/analytics/geo", getGeo);
adminRoutes.get("/analytics/active", getActiveUsersByOrg);

// Blog Routes
adminRoutes.get("/blogs", listBlogPostsAdmin);
adminRoutes.get("/blogs/:id", getBlogPostAdmin);
adminRoutes.post("/blogs", createBlogPost);
adminRoutes.put("/blogs/:id", updateBlogPost);
adminRoutes.delete("/blogs/:id", deleteBlogPost);
adminRoutes.post("/blogs/uploads", upload.single("image"), uploadBlogImage);

export default adminRoutes;
