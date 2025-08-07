import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import axios from "axios";
import dotenv from "dotenv";
import { Leads, LeadStatus } from "../../models/Leads";
import { JwtPayload } from "jsonwebtoken";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;


const aiPrompt = async(leads:any, keyword:string)=>{
  try{

  }catch(error:any){
    console.error("Error fetching AI response:", error.message);
    return null;
  }
}

export const leadsPrompt = async (request: JwtPayload, response: Response) => {
  const { keyword } = request.body;
  const userId = request.user.id

  try {
    const userLeads = await Leads.findAll({
      where: { owner_id: userId, status: LeadStatus.NEW },
    });

    const messages = [
      {
        role: "system",
        content: `You are a CRM assistant. Your job is to filter a list of leads and return ONLY the IDs of leads that are relevant to the user's keyword. Use intelligent semantic reasoning to find leads that match the intent of the keyword, not just literal keyword matches.
Return only a valid raw JSON array of matching IDs like: [1, 3, 5].
Do NOT return any extra explanation, comments, or formatting.`,
      },
      {
        role: "user",
        content: `Here is a list of leads:
${JSON.stringify(userLeads)}

Now, based on the following keyword or search intent:
"${keyword}"

Return only the IDs of leads that are **relevant** to this keyword. Consider fields such as location, phone number, job title, or any other data that implies a match — even if the keyword is not explicitly mentioned.
Return only a JSON array.`,
      },
    ];

    const headers = {
      "Content-Type": "application/json",
      "api-key": apiKey,
    };

    const aiResponse = await axios.post(
      `${endpoint}`,
      { messages, max_tokens: 2000 },
      { headers }
    );

    let aiContent = aiResponse.data?.choices?.[0]?.message?.content?.trim();

    // Strip accidental formatting
    if (aiContent.startsWith("```")) {
      aiContent = aiContent
        .replace(/^```(?:json)?/, "")
        .replace(/```$/, "")
        .trim();
    }

    const ids = JSON.parse(aiContent);

    // Fetch leads from DB
    const leads = await Leads.findAll({
      where: { id: ids },
    });

    sendResponse(response, 200, "success", leads);
    return;
  } catch (error: any) {
    console.log("Error in leadSearch controller", error.message);
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
