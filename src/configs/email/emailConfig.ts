import nodemailer from "nodemailer";
import dotenv from "dotenv";
import logger from "../../logger";
import {isProdEnv} from "../../utils/env";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: true,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

export const sendEmail = async (
  to: string,
  subject: string,
  text?: string,
  html?: string
) => {

  // In non-production environments, redirect emails to a test email
  const actualTo = isProdEnv ? to : (process.env.TEST_EMAIL || 'heemega@gmail.com');

  const mailOptions = {
    from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_USERNAME}>`,
    to: actualTo,
    subject,
    text,
    html,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to: ${actualTo} (intended: ${to}), subject: ${mailOptions.subject}, result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error(error, "Error sending email:");
    throw error;
  }
};
