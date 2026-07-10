import { Request, Response } from "express";
import logger from "../../logger";
import Users from "../../models/Users";
import sendResponse from "../../utils/http/sendResponse";
import { uploadFileToGcs } from "../../utils/storage/gcs";
import fs from "fs";

export const uploadProfilePicture = async (
  request: Request & { user?: any },
  response: Response
) => {
  try {
    const userId = request.user?.id;

    if (!userId) {
      logger.warn("uploadProfilePicture: No user ID in request");
      return sendResponse(response, 401, "User not authenticated");
    }

    // Check if file was uploaded
    if (!request.file) {
      logger.warn(`uploadProfilePicture failed: No file provided for user ${userId}`);
      return sendResponse(response, 400, "No image file provided");
    }

    const file = request.file;

    logger.info(`Uploading profile picture for user ${userId}, file size: ${file.size} bytes`);

    // Validate file type
    if (!file.mimetype.startsWith("image/")) {
      fs.unlinkSync(file.path);
      logger.warn(`uploadProfilePicture: Invalid file type ${file.mimetype} for user ${userId}`);
      return sendResponse(response, 400, "Only image files are allowed");
    }

    // Find user
    const user = await Users.findOne({ where: { id: userId } });
    if (!user) {
      fs.unlinkSync(file.path);
      logger.warn(`uploadProfilePicture: User not found for userId ${userId}`);
      return sendResponse(response, 401, "User not found");
    }

    try {
      // Upload to GCS
      const gcsPath = `profile-pictures/${userId}/${Date.now()}-${file.originalname}`;
      logger.info(`Uploading to GCS: ${gcsPath}`);

      const pictureUrl = await uploadFileToGcs({
        localPath: file.path,
        destination: gcsPath,
        contentType: file.mimetype,
      });

      logger.info(`Successfully uploaded to GCS: ${pictureUrl}`);

      // Update user profile picture
      user.picture = pictureUrl;
      await user.save();

      logger.info(`Profile picture updated for user ${userId}: ${pictureUrl}`);

      // Clean up local file
      fs.unlinkSync(file.path);

      return sendResponse(response, 200, "Profile picture updated successfully", {
        pictureUrl,
        userId,
      });
    } catch (uploadError: any) {
      // Clean up file on upload failure
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      logger.error(
        { error: uploadError.message },
        `Failed to upload profile picture for user ${userId}`
      );
      return sendResponse(
        response,
        500,
        "Failed to upload profile picture to storage"
      );
    }
  } catch (error: any) {
    // Clean up file if it still exists
    if (request.file && fs.existsSync(request.file.path)) {
      fs.unlinkSync(request.file.path);
    }

    logger.error(
      { error: error.message, stack: error.stack },
      "uploadProfilePicture Error"
    );
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};

export const getUserProfile = async (
  request: Request & { user?: any },
  response: Response
) => {
  try {
    const userId = request.user?.id;

    if (!userId) {
      logger.warn("getUserProfile: No user ID in request");
      return sendResponse(response, 401, "User not authenticated");
    }

    const user = await Users.findOne({
      where: { id: userId },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "picture",
        "phone",
        "organization_id",
      ],
    });

    if (!user) {
      logger.warn(`getUserProfile: User not found for userId ${userId}`);
      return sendResponse(response, 404, "User not found");
    }

    logger.info(`Retrieved profile for user ${userId}`);

    return sendResponse(response, 200, "Profile retrieved successfully", {
      user: user.get({ plain: true }),
    });
  } catch (error: any) {
    logger.error(
      { error: error.message, stack: error.stack },
      "getUserProfile Error"
    );
    return sendResponse(response, 500, "Internal Server Error", null, error.message);
  }
};
