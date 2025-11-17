import express, { Request, Response } from "express";
import { scrapeSinglePage } from "../utils/scraper";
import { getScrapedData } from "../controllers/scraperControllers/getScrapedData";

const scraperRoutes = express.Router();

// POST /v1/scraper/scrape
// Scrapes a single page and extracts information using AI
scraperRoutes.post("/scrape", getScrapedData);

export default scraperRoutes;
