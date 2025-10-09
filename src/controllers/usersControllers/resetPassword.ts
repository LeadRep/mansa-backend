import { Request, Response } from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import Users from "../../models/Users";
import PasswordResetToken from "../../models/PasswordResetToken";
import sendResponse from "../../utils/http/sendResponse";
import { hashPassword } from "../../utils/services/password";
import logger from "../../logger";

export const resetPassword = async (request: Request, response: Response) => {
  try {
    const { token, password } = request.body;

    if (!token || typeof token !== "string") {
      return sendResponse(response, 400, "A valid token is required");
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return sendResponse(
        response,
        400,
        "Password must be at least 8 characters long"
      );
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const tokenRecord = await PasswordResetToken.findOne({
      where: {
        token: hashedToken,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!tokenRecord) {
      return sendResponse(response, 400, "Invalid or expired reset token");
    }

    const user = await Users.findByPk(tokenRecord.userId);

    if (!user) {
      await tokenRecord.destroy();
      return sendResponse(response, 400, "User associated with token not found");
    }

    const hashedPassword = await hashPassword(password);
    await user.update({ password: hashedPassword });
    await tokenRecord.destroy();

    return sendResponse(response, 200, "Password updated successfully");
  } catch (error: any) {
    logger.error(error, "Reset password error:");
    return sendResponse(response, 500, "Internal Server Error");
  }
};

