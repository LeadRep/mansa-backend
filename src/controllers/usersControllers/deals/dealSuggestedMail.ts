import { Request, Response } from "express";
import logger from "../../../logger";
import sendResponse from "../../../utils/http/sendResponse";
import { DealContact } from "../../../models/DealContacts";
import Deals from "../../../models/Deals";
import { DealContactNote } from "../../../models/DealContactNotes";
import Users from "../../../models/Users";
import { aiService } from "../../../utils/http/services/aiService";
import { applyStageProbabilities } from "../../../utils/deals/stageProbabilities";

type SuggestedMail = {
  stage: string;
  subject: string;
  mail: string;
};

type SenderProfile = {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
};

const safeTrim = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const buildSenderSignature = (sender?: SenderProfile | null) => {
  const fullName = `${safeTrim(sender?.firstName)} ${safeTrim(sender?.lastName)}`.trim();
  return {
    fullName: fullName || "First name Last name",
    companyName: safeTrim(sender?.companyName) || "Company",
  };
};

const applySignature = (mail: string, sender?: SenderProfile | null): string => {
  const signature = buildSenderSignature(sender);
  const lines = safeTrim(mail)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const signOffMarkers = new Set([
    "best,",
    "best",
    "best regards,",
    "best regards",
    "regards,",
    "regards",
    "kind regards,",
    "kind regards",
    "thanks,",
    "thanks",
  ]);
  const lowerLines = lines.map((line) => line.toLowerCase());
  const signOffIndex = lowerLines.reduce((lastIndex, line, index) => {
    return signOffMarkers.has(line) ? index : lastIndex;
  }, -1);
  if (signOffIndex >= 0) {
    lines.splice(signOffIndex);
  }

  return [
    lines.join("\n").trim(),
    "",
    "Best regards,",
    signature.fullName,
    signature.companyName,
  ]
    .join("\n")
    .trim();
};

const normalizeSuggestedMail = (
  payload: unknown,
  stageId: string,
  fallback: SuggestedMail,
  sender?: SenderProfile | null
): SuggestedMail => {
  const subject = safeTrim((payload as any)?.subject) || fallback.subject;
  const mail = applySignature(safeTrim((payload as any)?.mail) || fallback.mail, sender);
  const stage = safeTrim((payload as any)?.stage) || stageId;

  return { stage, subject, mail };
};

const buildFallbackSuggestedMail = (
  contact: any,
  stage: { id: string; name: string; probability?: number },
  notes: DealContactNote[],
  sender?: SenderProfile | null
): SuggestedMail => {
  const firstName = safeTrim(contact?.first_name) || "there";
  const company = safeTrim(contact?.organization?.name) || "your team";
  const stageName = safeTrim(stage?.name) || "current stage";
  const probability = Number(stage?.probability ?? 0);
  const commentSummary = notes
    .map((note) => safeTrim(note.comment))
    .filter(Boolean)
    .slice(-2)
    .join(" ");

  const subject = `${stageName}: next step for ${company}`;
  const baseMail = [
    `Hi ${firstName},`,
    "",
    `I wanted to follow up as we move this conversation through the ${stageName} stage.`,
    commentSummary
      ? `Based on our latest notes, ${commentSummary}`
      : `At this point, teams with a ${probability}% close probability usually focus on clarifying timing, owners, and next actions.`,
    "",
    `Would you be open to a quick check-in so we can align on the next best step for ${company}?`,
  ].join("\n");

  return {
    stage: stage.id,
    subject,
    mail: applySignature(baseMail, sender),
  };
};

const generateSuggestedMail = async (
  contact: any,
  stage: { id: string; name: string; probability?: number },
  notes: DealContactNote[],
  sender?: SenderProfile | null
): Promise<SuggestedMail> => {
  const fallback = buildFallbackSuggestedMail(contact, stage, notes, sender);

  try {
    const noteContext = notes.slice(-10).map((note) => ({
      comment: note.comment,
      file_name: note.file_name,
      file_url: note.file_url,
      createdAt: note.get("createdAt"),
    }));
    const senderSignature = buildSenderSignature(sender);
    const messages = [
      {
        role: "system",
        content:
          "You generate concise stage-specific sales emails and return only valid JSON with double-quoted keys.",
      },
      {
        role: "user",
        content: `Generate one suggested follow-up email for a CRM deal lead.

Current stage:
${JSON.stringify(stage)}

Lead:
${JSON.stringify(contact)}

Comments and files:
${JSON.stringify(noteContext)}

Sender:
${JSON.stringify(senderSignature)}

Return only a JSON object with:
{
  "stage": "${stage.id}",
  "subject": "string",
  "mail": "string"
}

Requirements:
- The email must fit the current stage only.
- Use stage probability, comments, and files as context when relevant.
- Keep the mail practical and short.
- Include a greeting.
- End with the sender signature.
- Do not add markdown or explanations.`,
      },
    ];

    const response = await aiService.request({
      messages,
      max_tokens: 1200,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    return normalizeSuggestedMail(response.data, stage.id, fallback, sender);
  } catch (error: any) {
    logger.error(error, "Error generating deal suggested mail");
    return fallback;
  }
};

export const getOrGenerateDealSuggestedMail = async (
  request: Request,
  response: Response
) => {
  try {
    const userId = request.user?.id;
    const { contactId } = request.params;

    const contact = await DealContact.findOne({
      where: { id: contactId, owner_id: userId },
    });
    if (!contact) {
      sendResponse(response, 404, "Deal lead not found");
      return;
    }

    const deal = await Deals.findOne({
      where: { id: contact.deal_id, userId },
    });
    if (!deal) {
      sendResponse(response, 404, "Deal not found");
      return;
    }

    const currentStage = applyStageProbabilities(deal.stages || []).find(
      (stage: any) => stage.id === contact.stage_id
    );
    if (!currentStage) {
      sendResponse(response, 400, "Current stage not found");
      return;
    }

    const existingSuggestedMail = contact.suggested_mail as SuggestedMail | null;
    if (
      existingSuggestedMail &&
      existingSuggestedMail.stage === currentStage.id &&
      safeTrim(existingSuggestedMail.subject) &&
      safeTrim(existingSuggestedMail.mail)
    ) {
      sendResponse(response, 200, "Suggested mail retrieved", {
        suggested_mail: existingSuggestedMail,
        generated: false,
      });
      return;
    }

    const notes = await DealContactNote.findAll({
      where: { deal_contact_id: contact.id, owner_id: userId },
      order: [["createdAt", "ASC"]],
    });
    const user = await Users.findByPk(userId, {
      attributes: ["firstName", "lastName", "companyName"],
    });
    const sender = {
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      companyName: user?.companyName || null,
    };

    const suggestedMail = await generateSuggestedMail(
      contact.toJSON?.() ?? contact,
      currentStage,
      notes,
      sender
    );

    await contact.update({ suggested_mail: suggestedMail });

    sendResponse(response, 200, "Suggested mail generated", {
      suggested_mail: suggestedMail,
      generated: true,
    });
  } catch (error: any) {
    logger.error(error, "Error getting or generating deal suggested mail");
    sendResponse(
      response,
      500,
      "Failed to generate suggested mail",
      null,
      error.message
    );
  }
};
