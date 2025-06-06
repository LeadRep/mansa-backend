import express from "express";
import { customerPreference } from "../controllers/aiControllers/customerPreference.ts";
import { refreshLeads } from "../utils/services/refreshLeads.js";
// import { findPeople } from "../controllers/aiControllers/findPeople.js";

const aiRoutes = express.Router();
aiRoutes.post("/customer-pref", customerPreference);
aiRoutes.get("/find", refreshLeads);

export default aiRoutes;
