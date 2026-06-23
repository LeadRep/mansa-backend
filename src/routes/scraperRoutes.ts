import express, { Request, Response } from "express";
import { scrapeSinglePage } from "../utils/scraper";
import { getScrapedData } from "../controllers/scraperControllers/getScrapedData";
import { userAuth } from "../middlewares/userAuth";

const scraperRoutes = express.Router();

// POST /v1/scraper/scrape
// Scrapes a single page and extracts information using AI
// SECURITY: Requires authentication to prevent SSRF and resource abuse
scraperRoutes.post("/scrape", userAuth, getScrapedData);

export default scraperRoutes;
