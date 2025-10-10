import express from "express";
import { userAuth } from "../middlewares/userAuth";
import { getOrganization } from "../controllers/organizationsControllers/getOrganization";
import { updateOrganization } from "../controllers/organizationsControllers/updateOrganization";
import {inviteUser} from "../controllers/organizationsControllers/inviteUser";

const organizationsRoutes = express.Router();

organizationsRoutes.get("/:organization_id", userAuth, getOrganization);
organizationsRoutes.put("/:organization_id", userAuth, updateOrganization);
organizationsRoutes.post("/:organization_id/invite", userAuth, inviteUser);

export default organizationsRoutes;