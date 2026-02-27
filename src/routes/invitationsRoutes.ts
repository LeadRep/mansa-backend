import express from "express";
import {AcceptInvite} from "../controllers/invitations/AcceptInvite";
import {ValidateInvite} from "../controllers/invitations/ValidateInvite";

const invitationsRoutes = express.Router();

invitationsRoutes.post("/accept", AcceptInvite);
invitationsRoutes.get("/validate", ValidateInvite);


export default invitationsRoutes;