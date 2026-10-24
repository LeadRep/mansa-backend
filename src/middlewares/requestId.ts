import { v4 as uuidv4 } from "uuid";
import { Request, Response, NextFunction } from "express";
import { runWithRequestContext } from "../utils/requestContext";

/*
  Usage:
  app.use(pinoHttpMiddleware);
  app.use(attachRequestContext);
*/

export const attachRequestContext = (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).id || uuidv4();
  res.setHeader("X-Request-Id", reqId);

  // run the rest of the request inside ALS so any async code can call getRequestId()
  runWithRequestContext({ reqId }, () => next());
};