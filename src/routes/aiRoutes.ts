import express from "express";
import { customerPreference } from "../controllers/aiControllers/customerPreference.ts";
import { leadsPrompt } from "../controllers/aiControllers/leadPrompt.js";
import { userAuth } from "../middlewares/userAuth.js";
// import { findPeople } from "../controllers/aiControllers/findPeople.js";

const aiRoutes = express.Router();
aiRoutes.post("/customer-pref", customerPreference);
aiRoutes.post("/leads-prompt", userAuth, leadsPrompt);

export default aiRoutes;
