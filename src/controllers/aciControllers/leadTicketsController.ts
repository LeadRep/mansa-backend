// src/controllers/aciControllers/leadTicketsController.ts
import { Request, Response } from 'express';
import ACILeadTickets from '../../models/ACILeadTickets';
import Users from '../../models/Users';
import sendResponse from '../../utils/http/sendResponse';
import logger from '../../logger';
import {sendEmail} from "../../configs/email/emailConfig";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() ?? 'heemega@gmail.com';

const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sendTicketNotificationEmail = async (
  ticket: ACILeadTickets,
  userEmail: string
): Promise<void> => {
  const safeTicketId = escapeHtml(ticket.id);
  const safeLeadId = escapeHtml(ticket.leadId);
  const safeLeadName = escapeHtml(ticket.leadName);
  const safeLeadCompany = escapeHtml(ticket.leadCompany ?? '—');
  const safeField = escapeHtml(ticket.field);
  const safeDescription = escapeHtml(ticket.description);
  const safeUserEmail = escapeHtml(userEmail);

  await sendEmail(
    SUPPORT_EMAIL,
    `[New Ticket] ${safeField} — ${safeLeadName}`,
    undefined,
    `
      <h2>New data correction ticket submitted</h2>
      <table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td><strong>Ticket ID</strong></td><td>${safeTicketId}</td></tr>
        <tr><td><strong>Lead</strong></td><td>${safeLeadName} (${safeLeadId})</td></tr>
        <tr><td><strong>Company</strong></td><td>${safeLeadCompany}</td></tr>
        <tr><td><strong>Field</strong></td><td>${safeField}</td></tr>
        <tr><td><strong>Description</strong></td><td>${safeDescription}</td></tr>
        <tr><td><strong>Submitted by</strong></td><td>${safeUserEmail}</td></tr>
      </table>
    `
  );
};

export const createLeadTicket = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await Users.findOne({ where: { id: userId } });
    if (!user) {
      sendResponse(res, 401, 'User not found');
      return;
    }

    const { leadId } = req.params;
    const { field, description, leadName, leadCompany } = req.body;

    if (!field || !description) {
      sendResponse(res, 400, 'field and description are required');
      return;
    }

    const ticket = await ACILeadTickets.create({
      leadId,
      leadName: leadName ?? '',
      leadCompany: leadCompany ?? null,
      field,
      description: String(description).trim(),
      organizationId: user.organization_id,
      submittedBy: userId!,
    });
    // Fire-and-forget — email failure must not affect the response
    sendTicketNotificationEmail(ticket, user.email ?? userId!)
      .catch((err) => logger.error({ error: err?.message }, 'Failed to send ticket notification email'));

    sendResponse(res, 200, 'Ticket created', { data: ticket });
  } catch (error: any) {
    logger.error({ error: error?.message, stack: error?.stack }, 'Failed to create lead ticket');
    sendResponse(res, 500, 'Failed to create ticket', null, error?.message);
  }
};

export const listTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await Users.findOne({ where: { id: userId } });
    if (!user) {
      sendResponse(res, 401, 'User not found');
      return;
    }

    const tickets = await ACILeadTickets.findAll({
      where: { organizationId: user.organization_id },
      order: [['createdAt', 'DESC']],
    });

    sendResponse(res, 200, 'Tickets fetched', { data: tickets });
  } catch (error: any) {
    logger.error({ error: error?.message, stack: error?.stack }, 'Failed to fetch tickets');
    sendResponse(res, 500, 'Failed to fetch tickets', null, error?.message);
  }
};

export const listTicketsForLead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await Users.findOne({ where: { id: userId } });
    if (!user) {
      sendResponse(res, 401, 'User not found');
      return;
    }

    const { leadId } = req.params;

    const tickets = await ACILeadTickets.findAll({
      where: { leadId, organizationId: user.organization_id },
      order: [['createdAt', 'DESC']],
    });

    sendResponse(res, 200, 'Tickets fetched', { data: tickets });
  } catch (error: any) {
    logger.error({ error: error?.message, stack: error?.stack }, 'Failed to fetch lead tickets');
    sendResponse(res, 500, 'Failed to fetch lead tickets', null, error?.message);
  }
};