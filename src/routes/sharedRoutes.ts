import express from "express";
import { viewSharedLeads } from "../controllers/sharedControllers/viewSharedLeads";
const sharedRoutes = express.Router();

sharedRoutes.get("/leads/:token", viewSharedLeads);

export default sharedRoutes;
