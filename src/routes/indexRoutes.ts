import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";
import contactsRoutes from "./contactsRoutes";
import { test } from "../controllers/test";
import { generateLeads } from "../controllers/scripts/generateLeads";
import organizationsRoutes from "./organizationsRoutes";
import aciRoutes from "./aciRoutes";
import { findOrganizations } from "../controllers/scripts/findOrganizations";
import { getOrgs } from "../controllers/scripts/getOrganizations";
import { findOrganizationLeads } from "../controllers/scripts/findOrganizationLeads";

const indexRoutes = express.Router();
indexRoutes.get("/", index);
indexRoutes.use("/ai", aiRoutes);
indexRoutes.use("/users", usersRoutes);
indexRoutes.use("/contacts", contactsRoutes);
indexRoutes.use("/aci", aciRoutes);
indexRoutes.get("/test", findOrganizations);
indexRoutes.get("/get-orgs", getOrgs);
indexRoutes.get("/find-orgs", findOrganizations);
indexRoutes.get("/find-orgs-leads", findOrganizationLeads)
indexRoutes.use("/organizations", organizationsRoutes);
indexRoutes.use("/aci", aciRoutes);

export default indexRoutes;
