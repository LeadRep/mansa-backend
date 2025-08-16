import { Request, Response, NextFunction } from "express";
import logger from "../logger";
import pinoHttp from "pino-http";

// Custom serializers for request and response
const serializers = {
    req(req: Request) {
        const queryString = Object.keys(req.query).length
            ? "?" + new URLSearchParams(req.query as Record<string, string>).toString()
            : "";
        return {
            id: req.id,
            method: req.method,
            url: req.originalUrl || req.url + queryString,
        };
    },
    res(res: Response) {
        return {
            statusCode: res.statusCode,
        };
    },
};

export const pinoHttpMiddleware = pinoHttp({
    logger,
    serializers,
    customLogLevel: function (res, err) {
        const status = res.statusCode ?? 500;
        if (status >= 500) return "error";
        if (status >= 400) return "warn";
        return "info";
    },
    autoLogging: true,
});

export function httpLoggingMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
    const status = res.statusCode || 500;
    const logData = { err, url: req.url, method: req.method, status };

    if (status >= 500) {
        logger.error(logData, "Failing request");
    } else if (status >= 400) {
        logger.warn(logData, "Failing request");
    } else {
        logger.info(logData, "Request completed");
    }
    next(err);
}