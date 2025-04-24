import express from "express";
import { customerPreference } from "../controllers/aiControllers/customerPreference.ts";

const aiRoutes = express.Router();
aiRoutes.post("/customer-pref", customerPreference);

export default aiRoutes;
