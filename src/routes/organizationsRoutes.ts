import express from "express";
import { userAuth } from "../middlewares/userAuth";
import { getOrganization } from "../controllers/organizationsControllers/getOrganization";
import { updateOrganization } from "../controllers/organizationsControllers/updateOrganization";

const organizationsRoutes = express.Router();

organizationsRoutes.get("/:organization_id", userAuth, getOrganization);
organizationsRoutes.put("/:organization_id", userAuth, updateOrganization);

export default organizationsRoutes;