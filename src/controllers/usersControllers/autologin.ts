import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import Users from "../../models/Users";
import { generateRefreshToken, generateToken } from "../../utils/services/token";
import logger from "../../logger";
import Organizations from "../../models/Organizations";

export const autologin = async (request: Request, response: Response) => {
    const { userId } = request.body;
  try {
    const user = await Users.findOne({
      where: { id: userId },
      include: [
        {
          model: Organizations,
          as: "organization",
          attributes: ["organization_id", "name", "imModule", "basicModules", "demoAccount", "shareLeads"],
          required: false,
        },
      ],
    });
    if(!user) {
      sendResponse(response, 400, "Account not found");
      return;
    }
    const data = { id: user.id, email: user.email, role: user.role };
    const token = generateToken(data);
    const refreshToken = generateRefreshToken(data);

    const plainUser = user.get({ plain: true }) as any;
    const userResponse = {
      ...plainUser,
      password: undefined,
      imModule: Boolean(plainUser?.organization?.imModule ?? plainUser?.imModule),
    };

    return sendResponse(response, 200, "Login successful", {
      user: userResponse,
      token,
      refreshToken,
    });
  } catch (error: any) {
    logger.error(error, "Error during autologin:");
    sendResponse(response, 500, "Internal Server Error", error.message);
    return;
  }
};
