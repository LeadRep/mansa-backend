import express from "express";
import { userAuth } from "../middlewares/userAuth";
import {
    googleConsentBasicDetails, googleConsentReadEmail
} from "../controllers/usersControllers/contacts/google/googleContactsController";
import {
    getContacts,
    getUnreviewedContacts,
    saveReviewedContacts
} from "../controllers/usersControllers/contacts/contactsReviewController";
import {googleCallback} from "../controllers/usersControllers/contacts/google/googleCallBackController";

const contactsRoutes = express.Router();
contactsRoutes.get("/google/consent", userAuth, googleConsentBasicDetails);
contactsRoutes.get("/google/consent/email", userAuth, googleConsentReadEmail);

contactsRoutes.get("/google/callback", googleCallback);
contactsRoutes.get("/", userAuth, getContacts);
contactsRoutes.get("/review", userAuth, getUnreviewedContacts);
contactsRoutes.post("/review", userAuth, saveReviewedContacts);


export default contactsRoutes;
