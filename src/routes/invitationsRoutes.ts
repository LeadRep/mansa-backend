import express from "express";
import {AcceptInvite as acceptInvite} from "../controllers/invitations/AcceptInvite";
import {ValidateInvite as validateInvite} from "../controllers/invitations/ValidateInvite";

const invitationsRoutes = express.Router();

invitationsRoutes.post("/accept", acceptInvite);
invitationsRoutes.get("/validate", validateInvite);


export default invitationsRoutes;