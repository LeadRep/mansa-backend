import { NextFunction, Response, Request } from "express";
import Users from "../models/Users";
import { verifyToken } from "../utils/services/token";

export const userAuth = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    const authorization = request.headers.authorization;
    if (authorization === undefined) {
      response.status(401).json({
        status: `error`,
        message: `You are not authorized to view this page`,
        errorMessage: `Token not found`,
      });
      return;
    }

    const token = authorization.split(" ");
    const mainToken = token[1];
    if (!mainToken || mainToken === "") {
      response.status(401).json({
        status: `error`,
        message: `Login required`,
        errorMessage: `Token not found`,
      });
      return;
    }
    const decode: any = verifyToken(mainToken);

    const user: any = await Users.findOne({ where: { id: decode.id } });
    if (!user) {
      response.status(401).json({
        status: `error`,
        message: `Please check login credentials again`,
        errorMessage: `User not found`,
      });
      return;
    }

    request.user = decode;
    // update lastSeen timestamp for activity tracking
    try {
      await Users.update(
        { lastSeen: new Date() },
        { where: { id: decode.id } }
      );
    } catch (err) {
      // non-fatal: log and continue
      // logger may not be available here; silently continue
    }
    next();
  } catch (error: any) {
    response.status(401).json({
      status: "error",
      message: "Invalid or expired token",
      errorMessage: error.message,
    });
    return;
  }
};
