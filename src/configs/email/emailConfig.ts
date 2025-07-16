import nodemailer from "nodemailer";
import dotenv from "dotenv";

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
  const mailOptions = {
    from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_USERNAME}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent:", result);
    return result;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
