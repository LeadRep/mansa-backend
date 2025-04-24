import { Request, Response } from "express";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import { verifyPassword } from "../../utils/services/password";
import {
  generateRefreshToken,
  generateToken,
} from "../../utils/services/token";

export const loginUser = async (request: Request, response: Response) => {
  const { email, password } = request.body;
  try {
    const user = await Users.findOne({ where: { email } });
    if (!user) {
      sendResponse(response, 400, `${email} not found`);
      return;
    }

    const isPasswordValid = await verifyPassword(password, user?.password);
    if (!isPasswordValid) {
      sendResponse(response, 400, "Incorrect password");
      return;
    }

    const data = { id: user.id, email: user.email, role: user.role };
    const token = generateToken(data);
    const refreshToken = generateRefreshToken(data);
    user.password = undefined;

    sendResponse(response, 200, "Login successful", {
      user: user,
      token,
      refreshToken,
    });
    return;
  } catch (error: any) {
    console.error("Login Error:", error.message);
    sendResponse(response, 500, "Internal Server Error");
    return;
  }
};
