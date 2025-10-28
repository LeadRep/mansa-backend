import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";
import contactsRoutes from "./contactsRoutes";
import { test } from "../controllers/test";
import { generateLeads } from "../controllers/scripts/generateLeads";
import organizationsRoutes from "./organizationsRoutes";
import { getOrgs } from "../controllers/scripts/getOrganizations";
import { findOrganizations } from "../controllers/scripts/findOrganizations";
import { findOrganizationLeads } from "../controllers/scripts/findOrganizationLeads";
import aciRoutes from "./aciRoutes";

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

export default indexRoutes;
