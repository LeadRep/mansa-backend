import express from "express";
import { userAuth } from "../middlewares/userAuth";
import { getOrganization } from "../controllers/organizationsControllers/getOrganization";
import { updateOrganization } from "../controllers/organizationsControllers/updateOrganization";
import {getACILeads} from "../controllers/americanCenturyinvestment/getACILeads";
import {getACIQuotas} from "../controllers/americanCenturyinvestment/getACIQuotas";

const aciRoutes = express.Router();

aciRoutes.get("/leads", userAuth, getACILeads);
aciRoutes.get("/quota", userAuth, getACIQuotas);

export default aciRoutes;