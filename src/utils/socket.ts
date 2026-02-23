import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import logger from "../logger";
import { verifyToken } from "./services/token";
import Users from "../models/Users";

let io: SocketIOServer | null = null;

export const initSocket = (server: HTTPServer, allowedOrigins: string[]) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      next(new Error("Authentication error"));
      return;
    }

    const payload = verifyToken(token);

    if (!payload || typeof payload !== "object" || !("id" in payload)) {
      next(new Error("Authentication error"));
      return;
    }

    socket.data.userId = (payload as any).id;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;

    if (userId) {
      socket.join(`leads:${userId}`);
      logger.info(`Socket connected for user ${userId}`);
      // update lastSeen for real-time activity
      try {
        Users.update({ lastSeen: new Date() }, { where: { id: userId } });
      } catch (err) {
        logger.error(err, "Failed to update lastSeen on socket connect");
      }
    }

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getSocket = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }
  console.log("Socket.IO has not been initialized");
  return io;
};

export const emitLeadUpdate = (
  userId: string,
  payload: { leadIds?: string[] }
) => {
  if (!io) {
    return;
  }
  io.to(`leads:${userId}`).emit("leads:new", payload);
};
