import express from "express";
import { customerPreference } from "../controllers/aiControllers/customerPreference";
import { leadsPrompt } from "../controllers/aiControllers/leadPrompt";
import { userAuth } from "../middlewares/userAuth";
import { generateLeads } from "../controllers/scripts/generateLeads";
import { newSignUp } from "../controllers/aiControllers/newSignUp";
import { chatStream } from "../controllers/aiControllers/chat";
import { askAgentStream } from "../controllers/aiControllers/askAgent";
import { leadInsightsHandler } from "../controllers/aiControllers/leadInsights";
import {
  dealNextActionHandler,
  pipelineDigestHandler,
} from "../controllers/aiControllers/dealsInsights";
import {
  contactsEnrichHandler,
  contactsDedupeHandler,
} from "../controllers/aiControllers/contactsAI";
import {
  companyBriefHandler,
  companySimilarHandler,
} from "../controllers/aiControllers/companiesAI";
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatSessions,
} from "../controllers/aiControllers/chatSessions";
// import { findPeople } from "../controllers/aiControllers/findPeople.js";

const aiRoutes = express.Router();
// SECURITY: Requires authentication to prevent resource abuse and unauthorized AI operations
aiRoutes.post("/customer-pref", userAuth, customerPreference);
aiRoutes.post("/leads-prompt", userAuth, leadsPrompt);
aiRoutes.get("/test", generateLeads);
aiRoutes.post("/new", newSignUp);
aiRoutes.post("/chat", userAuth, chatStream);
aiRoutes.post("/ask", userAuth, askAgentStream);
aiRoutes.post("/leads/:leadId/insights", userAuth, leadInsightsHandler);
aiRoutes.post("/deals/:contactId/action", userAuth, dealNextActionHandler);
aiRoutes.get("/deals/digest", userAuth, pipelineDigestHandler);
aiRoutes.post("/contacts/enrich", userAuth, contactsEnrichHandler);
aiRoutes.post("/contacts/dedupe", userAuth, contactsDedupeHandler);
aiRoutes.get("/companies/brief/:id", userAuth, companyBriefHandler);
aiRoutes.get("/companies/similar/:id", userAuth, companySimilarHandler);
aiRoutes.get("/chat/sessions", userAuth, listChatSessions);
aiRoutes.post("/chat/sessions", userAuth, createChatSession);
aiRoutes.get("/chat/sessions/:sessionId", userAuth, getChatSession);
aiRoutes.delete("/chat/sessions/:sessionId", userAuth, deleteChatSession);

export default aiRoutes;
