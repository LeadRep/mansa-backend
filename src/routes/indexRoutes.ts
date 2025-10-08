import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";
import contactsRoutes from "./contactsRoutes";
import { test } from "../controllers/test";
import { generateLeads } from "../controllers/generateLeads";
import organizationsRoutes from "./organizationsRoutes";

const indexRoutes = express.Router();
indexRoutes.get("/", index);
indexRoutes.use("/ai", aiRoutes);
indexRoutes.use("/users", usersRoutes);
indexRoutes.use("/contacts", contactsRoutes);
indexRoutes.get("/test", test);
indexRoutes.use("/organizations", organizationsRoutes);

export default indexRoutes;
