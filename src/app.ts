import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { HttpError } from "http-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import { database } from "./configs/database/database";
import { json, urlencoded } from "body-parser";
import cron from "node-cron";
import http from "http";
import {
  pinoHttpMiddleware,
  httpLoggingMiddleware,
} from "./middlewares/httpLoggingMiddleware";
import path from "path";
// import * as glob from "glob";
// import serveFavicon from "serve-favicon";
import indexRoutes from "./routes/indexRoutes";
import { healthCheck } from "./controllers/healthCheck";
import { newUserSequence } from "./utils/services/newUserSequence";
import pinoLogger from "./logger";
import { initSocket } from "./utils/socket";
dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.APP_PORT || 3000;
app.use(json());
app.use(urlencoded({ extended: true }));
const allowedOrigins: string[] = [];
if (process.env.APP_DOMAIN) {
  allowedOrigins.push(process.env.APP_DOMAIN);
}
if (process.env.APP_ALT_DOMAINS) {
  allowedOrigins.push(
    ...process.env.APP_ALT_DOMAINS.split(",").map((origin) => origin.trim())
  );
}
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(pinoHttpMiddleware);
app.use(cookieParser());
app.get("/", (request: Request, response: Response) => {
  response.redirect("/v1");
});
app.use("/v1", indexRoutes);
app.get("/health-check", healthCheck);

initSocket(server, allowedOrigins);
database
  .sync({})
  .then(() => {
      pinoLogger.info("Database is connected");
  })
  .catch((err: HttpError) => {
      pinoLogger.error(err);
  });

// Schedule to run every day at 7 AM
cron.schedule(
  "0 7 * * *",
  async () => {
      pinoLogger.info("Running scheduled job at 7 AM...");
    try {
      await newUserSequence();
        pinoLogger.info("Scheduled job completed successfully");
    } catch (error) {
        pinoLogger.error(error, "Error in scheduled job:");
    }
  },
  {
    timezone: "America/New_York", // Set your timezone
  }
);
server.listen(port, () => {
    pinoLogger.info(`App running at port ${port}`);
});

app.use(httpLoggingMiddleware);

export default app;
