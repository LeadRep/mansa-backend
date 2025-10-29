import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";
import contactsRoutes from "./contactsRoutes";
import organizationsRoutes from "./organizationsRoutes";
import aciRoutes from "./aciRoutes";
import { deleteCompanies } from "../controllers/scripts/deleteCompanies";
import { generateLeads } from "../controllers/scripts/generateLeads";
import { classifyGeneralLeadSegments } from "../controllers/scripts/classifyGeneralLeadSegments";

const indexRoutes = express.Router();
indexRoutes.get("/", index);
indexRoutes.use("/ai", aiRoutes);
indexRoutes.use("/users", usersRoutes);
indexRoutes.use("/contacts", contactsRoutes);
indexRoutes.use("/aci", aciRoutes);
indexRoutes.use("/organizations", organizationsRoutes);
indexRoutes.get("/delete-companies", deleteCompanies);
indexRoutes.get("/generate-leads/:page/:endPage", generateLeads);
indexRoutes.get("/classify-general-leads/:limit", classifyGeneralLeadSegments);

export default indexRoutes;
