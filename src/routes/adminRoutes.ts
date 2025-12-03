import express from "express";
import { adminAuth } from "../middlewares/adminAuth";
import { getAllUsers, getUserDetails, updateUser, updateCustomerPref, createAdmin } from "../controllers/adminControllers/users";
import { getGeneralLeads } from "../controllers/adminControllers/leads";
import { getCompanies } from "../controllers/adminControllers/companies";

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

export default adminRoutes;
