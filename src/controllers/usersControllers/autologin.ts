import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import Users from "../../models/Users";
import { generateRefreshToken, generateToken } from "../../utils/services/token";

export const autologin = async (request: Request, response: Response) => {
    const { userId } = request.body;
  try {
    const user = await Users.findOne({ where: { id: userId } });
    if(!user) {
      sendResponse(response, 400, "Account not found");
      return;
    }
    const data = { id: user.id, email: user.email, role: user.role };
    const token = generateToken(data);
    const refreshToken = generateRefreshToken(data);

    const userResponse = { ...user.get(), password: undefined };

    return sendResponse(response, 200, "Login successful", {
      user: userResponse,
      token,
      refreshToken,
    });
  } catch (error: any) {
    console.error("Error during autologin:", error.message);
    sendResponse(response, 500, "Internal Server Error", error.message);
    return;
  }
};
