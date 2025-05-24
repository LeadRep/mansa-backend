import express from "express";
import { registerUser } from "../controllers/usersControllers/registerUser";
import { loginUser } from "../controllers/usersControllers/loginUser";
import { userLeads } from "../controllers/usersControllers/userLeads";
import { userAuth } from "../middlewares/userAuth";
import { payment, successPayment } from "../controllers/paymentControllers/pay";

const usersRoutes = express.Router();
usersRoutes.post("/register", registerUser);
usersRoutes.post("/login", loginUser);
usersRoutes.get("/leads", userAuth, userLeads);
usersRoutes.post("/pay", userAuth, payment);
usersRoutes.post("/verify-payment", userAuth, successPayment);

export default usersRoutes;
