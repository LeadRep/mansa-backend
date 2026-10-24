import pinoHttp from "pino-http";
import { v4 as uuidv4 } from "uuid";
import { Request, Response, NextFunction } from "express";
import logger from "../logger";
import { runWithRequestContext } from "../utils/requestContext";

/*
  Usage:
  app.use(requestLogger);
  app.use(attachRequestContext);
*/

export const requestLogger = pinoHttp({
  logger,
  genReqId: (_req: Request) => uuidv4(),
  customProps: (req: Request) => ({ reqId: (req as any).id }),
  serializers: {
    req: (req: any) => ({ id: req.id, method: req.method, url: req.url }),
  },
});

export const attachRequestContext = (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).id || uuidv4();
  res.setHeader("X-Request-Id", reqId);

  // run the rest of the request inside ALS so any async code can call getRequestId()
  runWithRequestContext({ reqId }, () => next());
};