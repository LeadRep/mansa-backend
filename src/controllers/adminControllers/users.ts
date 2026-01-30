import { Request, Response } from "express";
import Users, { userRole } from "../../models/Users";
import { CustomerPref } from "../../models/CustomerPref";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";
import { Op } from "sequelize";
import Organizations from "../../models/Organizations";
import { hashPassword } from "../../utils/services/password";
import { v4 } from "uuid";

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;
        const offset = (page - 1) * limit;

        const whereClause: any = {};
        if (search) {
            whereClause[Op.or] = [
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
            ];
        }

        const { count, rows } = await Users.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [["createdAt", "DESC"]]
        });

        sendResponse(res, 200, "Users fetched successfully", {
            users: rows,
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
        });
    } catch (error: any) {
        logger.error(error, "Error in getAllUsers:");
        sendResponse(res, 500, "Internal server error", null, error.message);
    }
};

export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await Users.findByPk(id);

        if (!user) {
            sendResponse(res, 404, "User not found", null);
            return;
        }

        const customerPref = await CustomerPref.findOne({ where: { userId: id } });

        sendResponse(res, 200, "User details fetched successfully", {
            user,
            customerPref,
        });
    } catch (error: any) {
        logger.error(error, "Error in getUserDetails:");
        sendResponse(res, 500, "Internal server error", null, error.message);
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await Users.findByPk(id);
        if (!user) {
            sendResponse(res, 404, "User not found", null);
            return;
        }

        await user.update(updates);
        sendResponse(res, 200, "User updated successfully", user);
    } catch (error: any) {
        logger.error(error, "Error in updateUser:");
        sendResponse(res, 500, "Internal server error", null, error.message);
    }
};

export const updateCustomerPref = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        const customerPref = await CustomerPref.findOne({ where: { userId } });

        if (!customerPref) {
            // Optionally create if not exists, but for now just error
            sendResponse(res, 404, "Customer preferences not found", null);
            return;
        }

        await customerPref.update(updates);
        sendResponse(res, 200, "Customer preferences updated successfully", customerPref);

    } catch (error: any) {
        logger.error(error, "Error in updateCustomerPref:");
        sendResponse(res, 500, "Internal server error", null, error.message);
    }
}

export const createAdmin = async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName } = req.body;

        if (!email || !password || !firstName || !lastName) {
            sendResponse(res, 400, "All fields are required", null);
            return;
        }

        const existingUser = await Users.findOne({ where: { email: email.toLowerCase() } });
        if (existingUser) {
            sendResponse(res, 400, "User already exists", null);
            return;
        }

        const hashedPassword = await hashPassword(password);
        const userId = v4();

        const org = await Organizations.create({
            organization_id: v4(),
            name: "Admin Org",
            plan: "free"
        });

        const user = await Users.create({
            id: userId,
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName,
            role: userRole.ADMIN,
            orgRole: userRole.ADMIN,
            organization_id: org.organization_id,
            isVerified: true
        });

        // Create customer preferences (required for some flows)
        await CustomerPref.create({
            id: v4(),
            userId,
            ICP: {} as any,
            BP: {} as any,
            territories: [],
            // Admins are provisioned with a higher initial refresh allowance than regular users
            refreshLeads: 1000
        });

        sendResponse(res, 200, "Admin created successfully", {
            id: user.id,
            email: user.email,
            role: user.role
        });

    } catch (error: any) {
        logger.error(error, "Error in createAdmin:");
        sendResponse(res, 500, "Internal server error", null, error.message);
    }
};
