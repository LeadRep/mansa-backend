import { Request, Response } from "express";
import { execSync } from "child_process";
import { Pool } from "pg";
import dotenv from "dotenv";
import logger from "../logger";

dotenv.config();

export const healthCheck = async (request: Request, response: Response) => {
  try {
    // Get available disk space in bytes
    const diskSpaceOutput = execSync("df -k / | tail -1 | awk '{print $4}'")
      .toString()
      .trim();
    const diskSpaceKilobytes = parseInt(diskSpaceOutput, 10);
    const diskSpaceBytes = diskSpaceKilobytes * 1024;
    const thresholdBytes = 100 * 1024 * 1024; // 100MB in bytes

    if (diskSpaceBytes < thresholdBytes) {
      response.status(400).json({
        status: "error", // Changed to 'error' for clarity on failure
        message: `Disk space is less than 100MB (${(
          diskSpaceBytes /
          (1024 * 1024)
        ).toFixed(2)}MB)`, // More informative message
        error: true,
      });
      return;
    }

    const pool = new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    });

    try {
      await pool.query("SELECT 1");
      logger.info("Database connection successful");

    } finally {
      await pool.end();
    }

    response.status(200).json({
      status: "success",
      message: "Health Check Passed",
      error: false,
    });
    return;
  } catch (error: any) {
    logger.error(error, "Health Check Error:");
    response.status(500).json({
      status: "error",
      message: "Health Check Failed",
      errorMessage: error.message,
      error: true,
    });
    return;
  }
};
