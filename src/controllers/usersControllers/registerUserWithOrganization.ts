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
import NewUsersSequence, { SequenceStatus } from "../../models/NewUsersSequence";
import { sequence1 } from "../../utils/mails/newUsers/sequence1";
import { createDeal } from "./deals/createDeal";
import logger from "../../logger";
import Organizations from "../../models/Organizations";
import Teams from "../../models/Teams";
import TeamMemberships from "../../models/TeamMemberships";

export const registerUserWithOrganization = async (req: Request, res: Response) => {
  try {
    const { user, icp, bp } = req.body;
    const userId = v4();
    const autoPassword = await hashPassword(userId);

    let email = user.email.toLowerCase();
    let isOAuthUser = false;
    let fullName = { firstName: user.firstName, lastName: user.lastName };

    if (user.google) {
      const googleDetails = await verifyGoogleToken(user.google);
      email = googleDetails.email.toLowerCase();
      fullName = {
        firstName: googleDetails.given_name,
        lastName: googleDetails.family_name,
      };
      isOAuthUser = true;
    } else if (user.microsoft) {
      const microsoftDetails = await verifyMicrosoftToken(user.microsoft);
      email = microsoftDetails.preferred_username?.toLowerCase() || "";
      isOAuthUser = true;
    }

    // Check if user already exists by email
    const existingUser = await Users.findOne({ where: { email:email.toLowerCase() } });
    if (existingUser) {
      return sendResponse(res, 400, "User already exists");
    }

    let userData: any = null;

    const org = await Organizations.create({
        organization_id: v4(),
        name: user.companyName,
        website: user.website || null,
        address: user.address || null,
        country: user.country || null,
        city: user.city || null,
        plan: "free"
    });

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
          orgRole: userRole.ADMIN,
          isBlocked: null,
          organization_id: org.organization_id,
      };

    const team = await Teams.create({
        team_id: v4(),
        organization_id: org.organization_id,
        name: "primary_team",
        description: "primary team"
    });

    if (user.google || user.microsoft) {
      userData = await Users.create({
        ...commonFields,
        email:email.toLowerCase(),
        firstName: fullName.firstName || "",
        lastName: fullName.lastName || "",
        password: autoPassword,
        isVerified: true,
      });
    } else if (user.email && user.password) {
      const hashedPassword = await hashPassword(user.password);
      userData = await Users.create({
        ...commonFields,
        email: user.email.toLowerCase(),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        password: hashedPassword,
        isVerified: false,
      });
    }

    const teamMemberShips = await TeamMemberships.create({
        team_id: team.team_id,
        user_id: userId,
        organization_id: org.organization_id,
        team_role: "member"
    });

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
          email: fullUserData.email.toLowerCase(),
          role: fullUserData.role,
        };
        const token = generateToken(tokenDetails);
        const refreshToken = generateRefreshToken(tokenDetails);
        data = { user: fullUserData, token, refreshToken };
      }
    }
    await createDeal(userId);
    sendResponse(
      res,
      200,
      "Account created successfully and verification email sent",
      data
    );
    sequence1(userData.email, userData.firstName, userId);
    const newUserSequence = await NewUsersSequence.create({
      id:v4(),
      email: userData.email.toLowerCase(),
      user_id: userId,
      first_sequence: {
        date: new Date(),
        status: SequenceStatus.SENT,
      },
    })
    findLeads(userId, 10);
    return;
  } catch (error: any) {
    logger.error(error, "User Registration Error:");
    return sendResponse(res, 500, "Internal Server Error");
  }
};
