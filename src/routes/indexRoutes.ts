import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";
import { index } from "../controllers";

const indexRoutes = express.Router();
indexRoutes.get("/", index)
indexRoutes.use("/ai", aiRoutes)
indexRoutes.use("/users", usersRoutes)

export default indexRoutes;