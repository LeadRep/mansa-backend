import express from "express";
import { registerUser } from "../controllers/usersControllers/registerUser";
import { loginUser } from "../controllers/usersControllers/loginUser";
import { userLeads } from "../controllers/usersControllers/userLeads";
import { userAuth } from "../middlewares/userAuth";
import { payment, successPayment } from "../controllers/paymentControllers/pay";
import { autologin } from "../controllers/usersControllers/autologin";
import { userCustomerPref } from "../controllers/usersControllers/userCustomerPref";
import { updateCustomerPref } from "../controllers/usersControllers/updateCustomerPref";
import { refreshLeads } from "../utils/services/refreshLeads";

const usersRoutes = express.Router();
usersRoutes.post("/register", registerUser);
usersRoutes.post("/login", loginUser);
usersRoutes.post("/autologin", autologin);
usersRoutes.get("/leads", userAuth, userLeads);
usersRoutes.post("/pay", userAuth, payment);
usersRoutes.post("/verify-payment", userAuth, successPayment);
usersRoutes.get("/customer-pref", userAuth, userCustomerPref);
usersRoutes.put("/customer-pref", userAuth, updateCustomerPref);
usersRoutes.post("/refresh-leads", userAuth, refreshLeads)

export default usersRoutes;
