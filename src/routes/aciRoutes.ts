import express from "express";
import { userAuth } from "../middlewares/userAuth";
import { getACIQuotas } from "../controllers/aciControllers/getACIQuotas";
import { getAciLeads } from "../controllers/aciControllers/getAciLeads";
import {exportLeads} from "../controllers/aciControllers/exportLeads";
import { createLeadTicket, listTickets, listTicketsForLead } from '../controllers/aciControllers/leadTicketsController';
import {
	excludeAciCompany,
	includeAciCompany,
	searchAciCompanies,
	listExcludedAciCompanies,
} from "../controllers/aciControllers/companyExclusionsController";

const aciRoutes = express.Router();

aciRoutes.get("/leads", userAuth, getAciLeads);
aciRoutes.get("/quota", userAuth, getACIQuotas);
aciRoutes.post("/export", userAuth, exportLeads);
aciRoutes.post('/leads/:leadId/tickets', userAuth, createLeadTicket);
aciRoutes.get('/tickets', userAuth, listTickets);
aciRoutes.get('/leads/:leadId/tickets', userAuth, listTicketsForLead);
aciRoutes.post("/companies/exclusions", userAuth, excludeAciCompany);
aciRoutes.delete("/companies/exclusions/:companyId", userAuth, includeAciCompany);
aciRoutes.get("/companies/exclusions", userAuth, listExcludedAciCompanies);
aciRoutes.get("/companies/search", userAuth, searchAciCompanies);
export default aciRoutes;
