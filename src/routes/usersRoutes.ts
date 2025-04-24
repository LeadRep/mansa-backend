import express from "express"

const usersRoutes = express.Router()
usersRoutes.post("/register")
usersRoutes.post("/login")

export default usersRoutes