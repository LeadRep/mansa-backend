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

const adminRoutes = express.Router();

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

export default adminRoutes;
