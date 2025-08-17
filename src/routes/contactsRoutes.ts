import express from "express";
import { userAuth } from "../middlewares/userAuth";
import {googleCallback, googleConsent, googleContacts} from "../controllers/usersControllers/UserContactsGoogle";

const contactsRoutes = express.Router();
contactsRoutes.get("/google/consent", userAuth, googleConsent);
contactsRoutes.get("/google/callback", googleCallback);
contactsRoutes.get("/google", userAuth, googleContacts);

export default contactsRoutes;
