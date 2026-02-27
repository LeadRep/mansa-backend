import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";

import contactsRoutes from "./contactsRoutes";
import organizationsRoutes from "./organizationsRoutes";
import aciRoutes from "./aciRoutes";
import scraperRoutes from "./scraperRoutes";
import adminRoutes from "./adminRoutes";
import { deleteCompanies } from "../controllers/scripts/deleteCompanies";
import { generateLeads } from "../controllers/scripts/generateLeads";
import { classifyGeneralLeadSegments } from "../controllers/scripts/classifyGeneralLeadSegments";
import { generateCSVLeads } from "../controllers/scripts/generateCSVLeads";
import sharedRoutes from "./sharedRoutes";
import blogRoutes from "./blogRoutes";
import invitationsRoutes from "./invitationsRoutes";

const indexRoutes = express.Router();
indexRoutes.get("/", index);
indexRoutes.use("/ai", aiRoutes);
indexRoutes.use("/users", usersRoutes);
indexRoutes.use("/contacts", contactsRoutes);
indexRoutes.use("/aci", aciRoutes);
indexRoutes.use("/scraper", scraperRoutes);
indexRoutes.use("/organizations", organizationsRoutes);
indexRoutes.use("/admin", adminRoutes);
indexRoutes.use("/shared", sharedRoutes);
indexRoutes.use("/blogs", blogRoutes);
indexRoutes.use("/invitations", invitationsRoutes);
indexRoutes.get("/delete-companies", deleteCompanies);
indexRoutes.get("/generate-leads/:page/:endPage", generateLeads);
indexRoutes.get("/classify-general-leads/:limit", classifyGeneralLeadSegments);

export default indexRoutes;

