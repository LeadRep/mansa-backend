import express from "express";
import { userAuth } from "../middlewares/userAuth";
import { getAciLeads } from "../controllers/aciControllers/getAciLeads";

const aciRoutes = express.Router();

aciRoutes.use(userAuth);
aciRoutes.get("/leads", getAciLeads);

export default aciRoutes;
