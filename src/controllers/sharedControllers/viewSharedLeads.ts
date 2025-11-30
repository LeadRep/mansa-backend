import { Request, Response } from "express";
import logger from "../../logger";
import SharedLeads from "../../models/ShareLeads";
import {Leads} from "../../models/Leads";
import { Op } from "sequelize";
import sendResponse from "../../utils/http/sendResponse";


export const viewSharedLeads = async (req: Request, res: Response) => {
    try {
        const { token } = req.params as { token: string };
        logger.info(`Viewing shared leads with token: ${token}`);
        // Validate token format
        if (!token || token.length !== 64) {
            return res.status(400).json({
                success: false,
                message: 'Invalid share token'
            });
        }
        const sharedLeads = await SharedLeads.findOne(
            {where: {token: token}}
        )

        if (sharedLeads === null) {
            return res.status(404).json({
                success: false,
                message: 'Shared link not found or has been revoked'
            });
        }

        // Check if expired
        if (new Date(sharedLeads.expiresAt) < new Date()) {
            return res.status(410).json({
                success: false,
                message: 'This shared link has expired'
            });
        }

        const leads = await Leads.findAll({where: {id: {
                    [Op.in]: sharedLeads.leadIds
        }}})

        sharedLeads.update(
            {
                accessedCount: sharedLeads.accessedCount + 1,
                lastAccessedAt: new Date()
            },
            {where: {token: token}}

        ).catch(error => {
            logger.error(error, "Error updating accessedCount and lastAccessedAt status:");
        });

        sendResponse(res, 200,
            "Shared leads retrieved successfully",
            {
                leads: leads,
                expiresAt: sharedLeads.expiresAt,
                isReadOnly: true
            }
            )
        return;

    } catch (error: any) {

        logger.error(error, 'Error retrieving shared leads:');
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve shared leads'
        });
    }
};
