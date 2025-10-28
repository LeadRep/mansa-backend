import express from "express";
import { customerPreference } from "../controllers/aiControllers/customerPreference";
import { leadsPrompt } from "../controllers/aiControllers/leadPrompt";
import { userAuth } from "../middlewares/userAuth";
import { generateLeads } from "../controllers/scripts/generateLeads";
import { newSignUp } from "../controllers/aiControllers/newSignUp";
import { chatStream } from "../controllers/aiControllers/chat";
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatSessions,
} from "../controllers/aiControllers/chatSessions";
// import { findPeople } from "../controllers/aiControllers/findPeople.js";

const aiRoutes = express.Router();
aiRoutes.post("/customer-pref", customerPreference);
aiRoutes.post("/leads-prompt", userAuth, leadsPrompt);
aiRoutes.get("/test", generateLeads);
aiRoutes.post("/new", newSignUp);
aiRoutes.post("/chat", userAuth, chatStream);
aiRoutes.get("/chat/sessions", userAuth, listChatSessions);
aiRoutes.post("/chat/sessions", userAuth, createChatSession);
aiRoutes.get("/chat/sessions/:sessionId", userAuth, getChatSession);
aiRoutes.delete("/chat/sessions/:sessionId", userAuth, deleteChatSession);

export default aiRoutes;
