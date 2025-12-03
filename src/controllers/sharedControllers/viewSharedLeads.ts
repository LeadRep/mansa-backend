import { Request, Response } from "express";
import logger from "../../logger";
import SharedLeads from "../../models/SharedLeads";
import {ArchivedSharedLeads} from "../../models/Leads";
import { Op } from "sequelize";
import sendResponse from "../../utils/http/sendResponse";


export const viewSharedLeads = async (req: Request, res: Response) => {
    try {
        const { token } = req.params as { token: string };
        logger.info(`Viewing shared leads with token: ${token}`);
        // Validate token format
        if (!token || token.length !== 64) {
            sendResponse(res, 400, 'Invalid share token');
            return;
        }
        const sharedLeads = await SharedLeads.findOne(
            {where: {token: token}}
        )

        if (sharedLeads === null) {
            sendResponse(res, 404, 'Shared link not found or has been revoked');
            return;
        }

        // Check if expired
        if (new Date(sharedLeads.expiresAt) < new Date()) {
            sendResponse(res, 410, 'This shared link has expired');
            return;
        }

        const leads = await ArchivedSharedLeads.findAll({where: {id: {
                    [Op.in]: sharedLeads.leadIds
        }}})

        SharedLeads.increment('accessedCount', {
            by: 1,
            where: { token: token }
        }).then(() => {
            SharedLeads.update(
                { lastAccessedAt: new Date() },
                { where: { token: token } }
            );
        }).catch(error => {
            logger.error(error, "Error updating access tracking:");
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
        sendResponse(res, 500, 'Failed to retrieve shared leads');
        return;
    }
};
