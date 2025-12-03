import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import crypto from "crypto";
import SharedLeads from "../../models/SharedLeads";
import {Op} from "sequelize";
import {ArchivedSharedLeads, Leads} from "../../models/Leads";

function generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
}

export const shareLeads = async (req: Request, res: Response) => {

  try {
    const userId = req.user?.id;
    const { leads } = req.body; // Array of lead IDs
      logger.info({ userId, leadCount: Array.isArray(leads) ? leads.length : 0 }, "Generating shareable link");

      if (!Array.isArray(leads) || leads.length === 0) {
          return res.status(400).json({
              success: false,
              message: 'Please provide at least one lead to share'
          });
      }
      // Validate each lead ID is a string
      if (!leads.every(id => typeof id === 'string' && id.length > 0)) {
          return res.status(400).json({
              success: false,
              message: 'All lead IDs must be valid strings'
          });
      }

      // Limit to reasonable number
      if (leads.length > 100) {
          return res.status(400).json({
              success: false,
              message: 'Cannot share more than 100 leads at once'
          });
      }

      // Validate that all leads belong to the user
      const ownedLeads = await Leads.findAll({
          where: {
              id: { [Op.in]: leads },
              owner_id: userId
          }
      });

      if (ownedLeads.length !== leads.length) {
          return res.status(403).json({
              success: false,
              message: 'You can only share leads that you own'
          });
      }
    // Exclude createdAt and updatedAt so archive timestamps reflect archiving time
    const records = ownedLeads.map(l => {
      const { createdAt, updatedAt, ...rest } = l.get({ plain: true });
      return rest;
    });

    try {
        await ArchivedSharedLeads.bulkCreate(records, { ignoreDuplicates: true });
    } catch (archiveError) {
        logger.error(archiveError, "Failed to archive shared leads, proceeding with share link creation");
    }

    // Generate unique token
      const token = generateShareToken();

      // Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const sharedLead = await SharedLeads.create({
          token: token,
          userId: userId,
          leadIds: leads,
          expiresAt: expiresAt
      })
      sendResponse(res, 201, "Shareable link generated successfully", {
          token: sharedLead.token,
          shareUrl: `${process.env.FRONTEND_URL}/shared-leads/${sharedLead.token}`,
          expiresAt: sharedLead.expiresAt,
          leadCount: leads.length
      })


  } catch (error: any) {
    logger.error(error, "Failed to generate shareable link");
    sendResponse(res, 500, "Failed to generate shareable link", null, error.message);
  }
};
