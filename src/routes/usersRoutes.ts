import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { registerUserWithOrganization } from "../controllers/usersControllers/registerUserWithOrganization";
import { loginUser } from "../controllers/usersControllers/loginUser";
import { classifyLeads } from "../controllers/usersControllers/classifyLeads";
import { classifyLeadsBulk } from "../controllers/usersControllers/classifyLeadsBulk";
import { userLeads } from "../controllers/usersControllers/userLeads";
import { userAuth } from "../middlewares/userAuth";
import { payment, successPayment } from "../controllers/paymentControllers/pay";
import { autologin } from "../controllers/usersControllers/autologin";
import { userCustomerPref } from "../controllers/usersControllers/userCustomerPref";
import { updateCustomerPref } from "../controllers/usersControllers/updateCustomerPref";
import { refreshLeads } from "../controllers/usersControllers/refreshLeads";
import { getUserDeals } from "../controllers/usersControllers/deals/getDeal";
import { getContactsByDealAndStage } from "../controllers/usersControllers/deals/getStageContacts";
import { moveContactToStage } from "../controllers/usersControllers/deals/moveContactStage";
import { addLeadToDeal } from "../controllers/usersControllers/addLeadToDeal";
import { deleteDealContact } from "../controllers/usersControllers/deals/deleteDealContact";
import { updateDealContact } from "../controllers/usersControllers/deals/updateDealContact";
import { getDealContactNotes } from "../controllers/usersControllers/deals/getDealContactNotes";
import { createDealContactNote } from "../controllers/usersControllers/deals/createDealContactNote";
import { uploadDealContactPhoto } from "../controllers/usersControllers/deals/uploadDealContactPhoto";
import { updateDealStages } from "../controllers/usersControllers/deals/updateStages";
import { deleteStage } from "../controllers/usersControllers/deals/deleteStage";
import { forgotPassword } from "../controllers/usersControllers/forgotPassword";
import { resetPassword } from "../controllers/usersControllers/resetPassword";
import { shareLeads } from "../controllers/usersControllers/shareLeads";

const usersRoutes = express.Router();
const dealNotesUploadDir = path.join(__dirname, "../../uploads/deals");
if (!fs.existsSync(dealNotesUploadDir)) {
  fs.mkdirSync(dealNotesUploadDir, { recursive: true });
}

const dealNotesUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, dealNotesUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { files: 5 },
});

const dealPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, dealNotesUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    return cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});
usersRoutes.post("/register", registerUserWithOrganization);
usersRoutes.post("/login", loginUser);
usersRoutes.get("/classifyLeads", classifyLeads);
usersRoutes.get("/classifyLeadsBulk", classifyLeadsBulk);
usersRoutes.post("/autologin", autologin);
usersRoutes.post("/forgot-password", forgotPassword);
usersRoutes.post("/reset-password", resetPassword);
usersRoutes.get("/leads", userAuth, userLeads);
usersRoutes.post("/leads/share", userAuth, shareLeads);
usersRoutes.post("/add-lead-to-deal", userAuth, addLeadToDeal);
usersRoutes.post("/pay", userAuth, payment);
usersRoutes.post("/verify-payment", userAuth, successPayment);
usersRoutes.get("/customer-pref", userAuth, userCustomerPref);
usersRoutes.put("/customer-pref", userAuth, updateCustomerPref);
usersRoutes.post("/refresh-leads", userAuth, refreshLeads);
usersRoutes.get("/deal", userAuth, getUserDeals);
usersRoutes.get(
  "/stage-contacts/:dealId/:stageId",
  userAuth,
  getContactsByDealAndStage
);
usersRoutes.post("/move-contact/:contactId", userAuth, moveContactToStage);
usersRoutes.delete(
  "/deal-contacts/:contactId",
  userAuth,
  deleteDealContact
);
usersRoutes.put("/deal-contacts/:contactId", userAuth, updateDealContact);
usersRoutes.get(
  "/deal-contacts/:contactId/notes",
  userAuth,
  getDealContactNotes
);
usersRoutes.post(
  "/deal-contacts/:contactId/notes",
  userAuth,
  dealNotesUpload.array("files", 5),
  createDealContactNote
);
usersRoutes.post(
  "/deal-contacts/uploads",
  userAuth,
  dealPhotoUpload.single("image"),
  uploadDealContactPhoto
);
usersRoutes.put("/deal/:dealId/stages", userAuth, updateDealStages);
usersRoutes.delete("/deal/:dealId/stages/:stageId", userAuth, deleteStage);

export default usersRoutes;
