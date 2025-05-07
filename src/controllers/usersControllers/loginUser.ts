import { Request, Response } from "express";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import { verifyPassword } from "../../utils/services/password";
import {
  generateRefreshToken,
  generateToken,
} from "../../utils/services/token";
import { verifyGoogleToken } from "../../utils/services/verifyGoogleToken";
import { verifyMicrosoftToken } from "../../utils/services/verifyMicrosoftToken";

export const loginUser = async (request: Request, response: Response) => {
  try {
    const { email, password, google, microsoft } = request.body;

    let userEmail = email;

    // Handle Google Login
    if (google) {
      const googleDetails = await verifyGoogleToken(google);
      userEmail = googleDetails.email;
    }

    // Handle Microsoft Login
    if (microsoft) {
      const microsoftDetails = await verifyMicrosoftToken(microsoft);
      userEmail = microsoftDetails.preferred_username || "";
    }

    const user = await Users.findOne({ where: { email: userEmail } });

    if (!user) {
      return sendResponse(response, 400, `${userEmail} not found`);
    }

    // If it's an OAuth login, skip password check
    if (!google && !microsoft) {
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return sendResponse(response, 400, "Incorrect password");
      }
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
    console.error("Login Error:", error.message);
    return sendResponse(response, 500, "Internal Server Error");
  }
};
