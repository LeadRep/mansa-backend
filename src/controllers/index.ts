import { Request, Response } from "express";

export const index = async (request: Request, response: Response) => {
  response.json({ error: false, message: "Welcome to Mansa Backend v2" });
  return;
};
