import { Request, Response } from "express";
import crypto from "crypto";
import Users from "../../models/Users";
import PasswordResetToken from "../../models/PasswordResetToken";
import sendResponse from "../../utils/http/sendResponse";
import { sendEmail } from "../../configs/email/emailConfig";
// import logger from "../../logger";

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

export const forgotPassword = async (request: Request, response: Response) => {
  try {
    const { email } = request.body;

    if (!email || typeof email !== "string") {
      return sendResponse(response, 400, "A valid email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await Users.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return sendResponse(
        response,
        200,
        "If an account exists, password reset instructions have been sent"
      );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await PasswordResetToken.destroy({ where: { userId: user.id } });
    await PasswordResetToken.create({
      userId: user.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
    });

    const baseUrl =
      process.env.PASSWORD_RESET_URL ||
      `${process.env.APP_DOMAIN || ""}/reset-password`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    const resetLink = `${baseUrl}${separator}token=${rawToken}`;

    const subject = "Reset your Mansa password";
    const text =
      `You recently requested to reset your password.\n\n` +
      `Use the link below to set a new password. This link will expire in 1 hour.\n\n${resetLink}\n\n` +
      `If you did not request a password reset, please ignore this email.`;
    const html = `
      <p>You recently requested to reset your password.</p>
      <p>Click the button below to choose a new password. This link will expire in 1 hour.</p>
      <p style="margin:24px 0; text-align:center;">
        <a href="${resetLink}" style="background:#07ABAA; color:#ffffff; padding:12px 20px; border-radius:6px; text-decoration:none; display:inline-block;">
          Reset Password
        </a>
      </p>
      <p>If the button above does not work, copy and paste this link into your browser:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this change, you can safely ignore this email.</p>
    `;

    await sendEmail(user.email, subject, text, html);

    return sendResponse(
      response,
      200,
      "If an account exists, password reset instructions have been sent"
    );
  } catch (error: any) {
    // logger.error(error, "Forgot password error:");
    console.log("Error:", error.message)
    return sendResponse(response, 500, "Internal Server Error");
  }
};

