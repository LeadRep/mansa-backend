import express from "express"
import { registerUser } from "../controllers/usersControllers/registerUser"
import { loginUser } from "../controllers/usersControllers/loginUser"

const usersRoutes = express.Router()
usersRoutes.post("/register", registerUser)
usersRoutes.post("/login", loginUser)

export default usersRoutes