import express from "express";
import { customerPreference } from "../controllers/aiControllers/customerPreference";
import { leadsPrompt } from "../controllers/aiControllers/leadPrompt";
import { userAuth } from "../middlewares/userAuth";
import { generateLeads } from "../controllers/generateLeads";
import { newSignUp } from "../controllers/aiControllers/newSignUp";
// import { findPeople } from "../controllers/aiControllers/findPeople.js";

const aiRoutes = express.Router();
aiRoutes.post("/customer-pref", customerPreference);
aiRoutes.post("/leads-prompt", userAuth, leadsPrompt);
aiRoutes.get("/test", generateLeads);
aiRoutes.post("/new", newSignUp);

export default aiRoutes;
