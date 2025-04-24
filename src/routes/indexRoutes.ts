import express from "express";
import aiRoutes from "./aiRoutes";
import usersRoutes from "./usersRoutes";

const indexRoutes = express.Router();
indexRoutes.use("/ai", aiRoutes)
indexRoutes.use("/users", usersRoutes)

export default indexRoutes;