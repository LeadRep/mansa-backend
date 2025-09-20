import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import axios from "axios";
import dotenv from "dotenv";
import { AIResponse, getCRMInsights } from "./customerPreference";
import logger from "../../logger";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

export const newSignUp = async (request: Request, response: Response) => {
  const { keyword } = request.body;
  try {
    const messages = [
      {
        role: "system",
        content: `You are a CRM assistant. 
Your ONLY job is to extract structured sign-up data from free text.
You MUST return a valid JSON object ONLY — no explanations, no markdown, no comments.
If some fields cannot be extracted, return them as empty strings.`,
      },
      {
        role: "user",
        content: `Extract the following fields from this keyword: "${keyword}".
Return the result in this exact JSON schema:

{
  "firstName": "",
  "lastName": "",
  "companyName": "",
  "website": "",
  "country": "",
  "role": ""
}`,
      },
    ];

    const headers = {
      "Content-Type": "application/json",
      "api-key": apiKey,
    };

    const aiResponse = await axios.post(
      `${endpoint}`,
      { messages, max_tokens: 500 }, // reduced tokens for efficiency
      { headers }
    );

    let aiContent = aiResponse.data?.choices?.[0]?.message?.content?.trim();
    logger.info({input: keyword, aiResponse: aiContent}, "Raw AI response:");

    // Strip accidental markdown fences
    if (aiContent.startsWith("```")) {
      aiContent = aiContent
        .replace(/^```(?:json)?/, "")
        .replace(/```$/, "")
        .trim();
    }

    let extractedData;
    try {
      extractedData = JSON.parse(aiContent);
    } catch (parseError) {
      logger.error(parseError, "Invalid JSON from AI, falling back to empty template.");
      extractedData = {
        firstName: "",
        lastName: "",
        companyName: "",
        website: "",
        country: "",
        role: "",
      };
    }

    let insights: AIResponse | null = null;
    do {
      insights = await getCRMInsights(
        extractedData.companyName,
        extractedData.role,
        extractedData.website,
        extractedData.country
      );
    } while (insights === null || typeof insights !== "object");
    sendResponse(response, 200, "success", {
      user: extractedData,
      insights,
    });

    return;
  } catch (error: any) {
    logger.error(error, "Error in newSignUp controller:");
    sendResponse(
      response,
      500,
      "Internal Server Error",
      null,
      error.message || "Something went wrong"
    );
    return;
  }
};
