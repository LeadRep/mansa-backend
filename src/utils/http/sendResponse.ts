import { Response } from "express";

const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  res.status(statusCode).json({
    status: statusCode === 200 ? "success" : "error",
    message,
    error: statusCode === 200 ? false : true,
    data: data || null,
  });
};

export default sendResponse;
