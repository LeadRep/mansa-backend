import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";
import contactsRoutes from "./contactsRoutes";
import { test } from "../controllers/test";
import { generateLeads } from "../controllers/generateLeads";
import organizationsRoutes from "./organizationsRoutes";
import aciRoutes from "./aciRoutes";

const indexRoutes = express.Router();
indexRoutes.get("/", index);
indexRoutes.use("/ai", aiRoutes);
indexRoutes.use("/users", usersRoutes);
indexRoutes.use("/contacts", contactsRoutes);
indexRoutes.get("/test", test);
indexRoutes.use("/organizations", organizationsRoutes);
indexRoutes.use("/aci", aciRoutes);

export default indexRoutes;
