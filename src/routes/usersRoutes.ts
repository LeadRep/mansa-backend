import express from "express"
import { registerUser } from "../controllers/usersControllers/registerUser"
import { loginUser } from "../controllers/usersControllers/loginUser"
import { userLeads } from "../controllers/usersControllers/userLeads"
import { userAuth } from "../middlewares/userAuth"

const usersRoutes = express.Router()
usersRoutes.post("/register", registerUser)
usersRoutes.post("/login", loginUser)
usersRoutes.get("/leads", userAuth, userLeads)

export default usersRoutes