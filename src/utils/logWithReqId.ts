import pinoLogger from "../logger";
import { getRequestId } from "./requestContext";

type LogArgs = [message: string, ...args: any[]] | [obj: any, message?: string, ...args: any[]];

const addReqId = (obj?: any) => {
  const reqId = getRequestId();
  if (!reqId) return obj;
  return obj instanceof Error ? { err: obj, reqId } : { ...(obj || {}), reqId };
};

export const info = (...args: LogArgs) => {
  // support both pino signature styles: (msg, ...meta) or (obj, msg?, ...)
  if (typeof args[0] === "string") {
    pinoLogger.info(addReqId(undefined), ...args);
  } else {
    const [obj, ...rest] = args;
    pinoLogger.info(addReqId(obj), ...rest);
  }
};

export const warn = (...args: LogArgs) => {
  if (typeof args[0] === "string") {
    pinoLogger.warn(addReqId(undefined), ...args);
  } else {
    const [obj, ...rest] = args;
    pinoLogger.warn(addReqId(obj), ...rest);
  }
};

export const error = (...args: LogArgs) => {
  if (typeof args[0] === "string") {
    pinoLogger.error(addReqId(undefined), ...args);
  } else {
    const [obj, ...rest] = args;
    pinoLogger.error(addReqId(obj), ...rest);
  }
};

export const debug = (...args: LogArgs) => {
  if (typeof args[0] === "string") {
    pinoLogger.debug(addReqId(undefined), ...args);
  } else {
    const [obj, ...rest] = args;
    pinoLogger.debug(addReqId(obj), ...rest);
  }
};

export default {
  info,
  warn,
  error,
  debug,
};