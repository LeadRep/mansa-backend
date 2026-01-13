import express from "express";
import { registerUserWithOrganization } from "../controllers/usersControllers/registerUserWithOrganization";
import { loginUser } from "../controllers/usersControllers/loginUser";
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
import { forgotPassword } from "../controllers/usersControllers/forgotPassword";
import { resetPassword } from "../controllers/usersControllers/resetPassword";
import { shareLeads } from "../controllers/usersControllers/shareLeads";

const usersRoutes = express.Router();
usersRoutes.post("/register", registerUserWithOrganization);
usersRoutes.post("/login", loginUser);
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

export default usersRoutes;
