import express from "express";
import { userAuth } from "../middlewares/userAuth";
import { getACILeads } from "../controllers/americanCenturyinvestment/getACILeads";
import { getACIQuotas } from "../controllers/americanCenturyinvestment/getACIQuotas";
import { decrementACIQuotas } from "../controllers/americanCenturyinvestment/decrementACIQuotas";
import { getAciLeads } from "../controllers/aciControllers/getAciLeads";
import {exportLeads} from "../controllers/aciControllers/exportLeads";

const aciRoutes = express.Router();

aciRoutes.get("/leads", userAuth, getAciLeads);
aciRoutes.get("/quota", userAuth, getACIQuotas);
aciRoutes.put("/quota", userAuth, decrementACIQuotas);
aciRoutes.post("/export", userAuth, exportLeads);

export default aciRoutes;
