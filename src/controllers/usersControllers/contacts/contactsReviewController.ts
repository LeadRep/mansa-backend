import {JwtPayload} from "jsonwebtoken";
import {Response} from "express";
import UserContactsStaging, {UserContactsStagingAttributes} from "../../../models/UserContactsStaging";
import logger from "../../../logger";
import Contacts from "../../../models/Contacts";
import {WarmLeads} from "../../../models/WarmLeads";
import UserLinkedAccounts from "../../../models/UserLinkedAccounts";
import UserLinkedAccountsToken from "../../../models/UserLinkedAccountTokens";

export const getUnreviewedContacts = async (
    request: JwtPayload,
    response: Response
) => {
    const userId = request.user.id;
    const accountId = request.query.accountId as string;
    if (!accountId) {
        response.status(400).json({ message: 'accountId query parameter is required.' });
        return;
    }
    const linkedAccount = await UserLinkedAccounts.findOne({ where: { user_account_id: accountId, user_id: userId } });
    if (!linkedAccount) {
        response.status(404).json({ message: 'No contacts found for the given accountId.' });
        return;
    }
    const linkedAccountToken = UserLinkedAccountsToken.findOne(
        { where: { user_account_id: accountId, scope: 2 } }
    )
    try {
        const contacts = await UserContactsStaging.findAll({
            where: { user_id: userId, user_account_id: accountId },
            attributes: ['contact_id', 'user_id', 'user_account_id', 'source_contact_id', 'raw_data', 'first_name', 'last_name', 'full_name', 'email', 'phone', 'is_complete', 'validation_required', 'is_skipped']
        });
        response.status(200).json({
            contacts: contacts,
            email_permission_granted: !!linkedAccountToken
        });
    } catch (error: any) {
        logger.error(error, `Error fetching user contacts:${error?.stack || error?.message || error}.`);
        response.status(500).json({ message: 'Internal server error.' });
    }
}


export const saveReviewedContacts = async (
    request: JwtPayload,
    response: Response
) => {
    logger.info("saving reviewed contacts");
    const userId = request.user.id;
    const { contacts } = request.body;
    if (!contacts || !Array.isArray(contacts)) {
        response.status(400).json({ message: 'Invalid request body. Expected an array of contacts.' });
        return;
    }
    //set is_complete to true and validation_required to false for all contacts
    const contactsToUpsert = contacts.map((contact: UserContactsStagingAttributes) => ({
        ...contact,
        is_complete: true,
        validation_required: false,
    }));
    await UserContactsStaging.bulkCreate(contactsToUpsert, {
        updateOnDuplicate: [
            'raw_data',
            'first_name',
            'last_name',
            'full_name',
            'email',
            'phone',
            'is_complete',
            'validation_required',
            'is_skipped',
        ],
        conflictAttributes: ['user_id', 'user_account_id', 'source_contact_id']
    });

    await Contacts.bulkCreate(contactsToUpsert, {
        updateOnDuplicate: [
            'raw_data',
            'first_name',
            'last_name',
            'full_name',
            'email',
            'phone',
            'is_complete',
            'validation_required',
            'is_skipped',
        ],
        conflictAttributes: ['user_id', 'user_account_id', 'source_contact_id']
    });

    // delete all contacts in contacts array from UserContactsStaging
    await UserContactsStaging.destroy({
        where: {
            user_id: userId,
            contact_id: contacts.map((c: UserContactsStagingAttributes) => c.contact_id)
        }
    });
    response.status(200).json({ message: 'Contacts updated successfully.' });
}

export const getContacts = async (
    request: JwtPayload,
    response: Response
) => {
    const userId = request.user.id;
    try {
        // Fetch all contacts for the user
        const userContacts = await Contacts.findAll({
            where: { user_id: userId, is_skipped: false },
            attributes: ['contact_id', 'full_name', 'phone', 'email', 'warmlead_id']
        });

        // Collect all warmlead_ids that are not null
        const warmleadIds = userContacts
            .map((contact: any) => contact.warmlead_id)
            .filter((id: any) => id);

        // Fetch all warmleads in one query
        let warmleadsMap: Record<string, any> = {};
        if (warmleadIds.length > 0) {
            const warmleads = await WarmLeads.findAll({
                where: { id: warmleadIds }
            });
            warmleadsMap = warmleads.reduce((acc: any, wl: any) => {
                acc[wl.id] = wl;
                return acc;
            }, {});
        }

        // Add warmlead to each contact if applicable
        const contactsWithWarmlead = userContacts.map((contact: any) => {
            const contactObj = contact.toJSON();
            if (contact.warmlead_id && warmleadsMap[contact.warmlead_id]) {
                contactObj.warmlead = warmleadsMap[contact.warmlead_id];
            }
            return contactObj;
        });
        response.status(200).json({ data: contactsWithWarmlead});
    } catch (error: any) {
        logger.error(error, `Error fetching user contacts: ${error?.stack || error?.message || error}.`);
        response.status(500).json({ message: 'Internal server error.' });
    }
}