import { Request, Response } from "express";
import Users, { userRole } from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import { v4 } from "uuid";
import { hashPassword } from "../../utils/services/password";
import { CustomerPref } from "../../models/CustomerPref";
import { verifyGoogleToken } from "../../utils/services/verifyGoogleToken";
import { verifyMicrosoftToken } from "../../utils/services/verifyMicrosoftToken";
import {
  generateRefreshToken,
  generateToken,
} from "../../utils/services/token";
import { findLeads } from "../aiControllers/findLeads";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { user, icp, bp } = req.body;
    const userId = v4();
    const autoPassword = await hashPassword(userId);

    let email = user.email;
    let isOAuthUser = false;
    let fullName = { firstName: user.firstName, lastName: user.lastName };

    if (user.google) {
      const googleDetails = await verifyGoogleToken(user.google);
      email = googleDetails.email;
      fullName = {
        firstName: googleDetails.given_name,
        lastName: googleDetails.family_name,
      };
      isOAuthUser = true;
    } else if (user.microsoft) {
      const microsoftDetails = await verifyMicrosoftToken(user.microsoft);
      email = microsoftDetails.preferred_username || "";
      isOAuthUser = true;
    }

    // Check if user already exists by email
    const existingUser = await Users.findOne({ where: { email } });
    if (existingUser) {
      return sendResponse(res, 400, "User already exists");
    }

    let userData: any = null;

    const commonFields = {
      id: userId,
      userName: user.userName || null,
      phone: user.phone,
      picture: user.picture || null,
      companyName: user.companyName,
      website: user.website || null,
      address: user.address || null,
      country: user.country || null,
      city: user.city || null,
      role: userRole.USER,
      isBlocked: null,
    };

    if (user.google || user.microsoft) {
      userData = await Users.create({
        ...commonFields,
        email,
        firstName: fullName.firstName || "",
        lastName: fullName.lastName || "",
        password: autoPassword,
        isVerified: true,
      });
    } else if (user.email && user.password) {
      const hashedPassword = await hashPassword(user.password);
      userData = await Users.create({
        ...commonFields,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        password: hashedPassword,
        isVerified: false,
      });
    }

    // Create customer preferences
    await CustomerPref.create({
      id: v4(),
      userId,
      ICP: icp,
      BP: bp,
      territories: user.territories || [],
    });

    // Generate token and refreshToken if OAuth user
    let data = null;
    if (isOAuthUser && userData) {
      const fullUserData = await Users.findByPk(userId, { raw: true });
      if (fullUserData) {
        delete fullUserData.password;
        const tokenDetails = {
          id: fullUserData.id,
          email: fullUserData.email,
          role: fullUserData.role,
        };
        const token = generateToken(tokenDetails);
        const refreshToken = generateRefreshToken(tokenDetails);
        data = { user: fullUserData, token, refreshToken };
      }
    }

    sendResponse(
      res,
      200,
      "Account created successfully and verification email sent",
      data
    );
    findLeads(userId, 10);
    return;
  } catch (error: any) {
    console.error("User Registration Error:", error.message);
    return sendResponse(res, 500, "Internal Server Error");
  }
};
