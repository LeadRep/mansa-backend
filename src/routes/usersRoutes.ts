import express from "express";
import { registerUser } from "../controllers/usersControllers/registerUser";
import { loginUser } from "../controllers/usersControllers/loginUser";
import { userLeads } from "../controllers/usersControllers/userLeads";
import { userAuth } from "../middlewares/userAuth";
import { payment, successPayment } from "../controllers/paymentControllers/pay";
import { autologin } from "../controllers/usersControllers/autologin";
import { userCustomerPref } from "../controllers/usersControllers/userCustomerPref";

const usersRoutes = express.Router();
usersRoutes.post("/register", registerUser);
usersRoutes.post("/login", loginUser);
usersRoutes.post("/autologin", autologin);
usersRoutes.get("/leads", userAuth, userLeads);
usersRoutes.post("/pay", userAuth, payment);
usersRoutes.post("/verify-payment", userAuth, successPayment);
usersRoutes.get("/customer-pref", userAuth, userCustomerPref)

export default usersRoutes;
