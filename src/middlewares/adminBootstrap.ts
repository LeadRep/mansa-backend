import { NextFunction, Response, Request } from "express";
import Users, { userRole } from "../models/Users";

/**
 * Middleware that allows admin creation only if no admins exist in the system.
 * After the first admin is created, this endpoint becomes protected.
 * For subsequent admin creation, use adminAuth middleware.
 */
export const adminBootstrap = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const adminCount = await Users.count({
      where: { role: userRole.ADMIN },
    });

    // Allow creation only if no admins exist
    if (adminCount > 0) {
      response.status(403).json({
        status: "error",
        message: "Admin account already exists. Contact an existing admin to create new admin accounts.",
        errorMessage: "Admin bootstrap already completed",
      });
      return;
    }

    next();
  } catch (error: any) {
    response.status(500).json({
      status: "error",
      message: "Server error",
      errorMessage: error.message,
    });
    return;
  }
};
