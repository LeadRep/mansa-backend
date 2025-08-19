import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { HttpError } from "http-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import { database } from "./configs/database/database";
import { json, urlencoded } from "body-parser";
import logger from "morgan";
import cron from "node-cron";
import { pinoHttpMiddleware, httpLoggingMiddleware } from "./middlewares/httpLoggingMiddleware";
import path from "path";
// import * as glob from "glob";
// import serveFavicon from "serve-favicon";
import indexRoutes from "./routes/indexRoutes";
import { healthCheck } from "./controllers/healthCheck";
import { newUserSequence } from "./utils/services/newUserSequence";
dotenv.config();

const app = express();
const port = process.env.APP_PORT || 3000;
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cors({
    origin: process.env.APP_DOMAIN,
    credentials: true
}));
app.use(logger("dev"));
// Pino for incoming HTTP logging- duplicated with morgan. one will be removed later
app.use(pinoHttpMiddleware);
app.use(cookieParser());
app.get("/", (request: Request, response: Response) => {
  response.redirect("/v1");
});
app.use("/v1", indexRoutes);
app.get("/health-check", healthCheck);
database
  .sync({})
  .then(() => {
    console.log("Database is connected");
  })
  .catch((err: HttpError) => {
    console.log(err);
  });

// Schedule to run every day at 7 AM
cron.schedule(
  "0 7 * * *",
  async () => {
    console.log("Running scheduled job at 7 AM...");
    try {
      await newUserSequence();
      console.log("Scheduled job completed successfully");
    } catch (error) {
      console.error("Error in scheduled job:", error);
    }
  },
  {
    timezone: "America/New_York", // Set your timezone
  }
);
app.listen(port, () => {
  console.log(`App running at port ${port}`);
});

app.use(httpLoggingMiddleware);

export default app;
