import { Request, Response } from "express";
import Users, { userRole } from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import { v4 } from "uuid";
import { hashPassword } from "../../utils/services/password";
import { CustomerPref } from "../../models/CustomerPref";

export const registerUser = async (request: Request, response: Response) => {
  const { user, icp, bp } = request.body;
  if (!user || !user.email) {
    sendResponse(response, 400, "Email is required");
    return;
  }
  try {
    const existingUser = await Users.findOne({ where: { email: user.email } });
    if (existingUser) {
      sendResponse(response, 400, "User already exists");
      return;
    }
    const userId = v4();
    const hashedPassword = await hashPassword(user.password);
    const newUser = await Users.create({
      id: userId,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      picture: user.picture || null,
      companyName: user.companyName,
      role: userRole.USER,
      website: user.website || null,
      address: user.address || null,
      country: user.country || null,
      city: user.city || null,
      password: hashedPassword,
      isVerified: false,
      isBlocked: null,
    });

    // Create customer preferences
    const customerPref = await CustomerPref.create({
      id: v4(),
      userId: userId,
      ICP: icp,
      BP: bp,
      territories: user.territories || [],
    });
    sendResponse(
      response,
      200,
      "Account created successfully and verification email sent"
    );
    return;
  } catch (error: any) {
    console.log("User Registration Error :", error.message);
    sendResponse(response, 500, "Internal Server Error");
    return;
  }
};
