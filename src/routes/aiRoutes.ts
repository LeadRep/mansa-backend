import express from "express";
import { customerPreference } from "../controllers/aiControllers/customerPreference.ts";
import { findPeople } from "../controllers/aiControllers/findPeople.js";

const aiRoutes = express.Router();
aiRoutes.post("/customer-pref", customerPreference);
aiRoutes.get("/find", findPeople);

export default aiRoutes;
