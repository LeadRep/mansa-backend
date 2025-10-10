import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";
import contactsRoutes from "./contactsRoutes";
import { test } from "../controllers/test";
import organizationsRoutes from "./organizationsRoutes";
import invitationsRoutes from "./InvitationsRoutes";

const indexRoutes = express.Router();
indexRoutes.get("/", index);
indexRoutes.use("/ai", aiRoutes);
indexRoutes.use("/users", usersRoutes);
indexRoutes.use("/contacts", contactsRoutes);
indexRoutes.get("/test", test);
indexRoutes.use("/organizations", organizationsRoutes);
indexRoutes.use("/invitations", invitationsRoutes);


export default indexRoutes;
