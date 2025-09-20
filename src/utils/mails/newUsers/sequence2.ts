import { sendEmail } from "../../../configs/email/emailConfig";
import dotenv from "dotenv";
import logger from "../../../logger";

dotenv.config();
export const sequence2 = async(to: string, firstName: string, userId:string) => {
  try {
    await sendEmail(
      to,
      'Still limited to 10 searches?',
      ``,
      `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Still limited to 10 searches?</title>
    <style type="text/css">
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .email-container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .highlight {
            color: #0177D2;
            font-weight: bold;
        }
        .urgent {
            color: #D12B2B;
            font-weight: bold;
        }
        .cta-link {
            display: inline-block;
            background: linear-gradient(to bottom, #1F96DD, #19BDD2);
            color: white !important;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 15px 0;
        }
        .signature {
            margin-top: 25px;
            border-top: 1px solid #eeeeee;
            padding-top: 20px;
        }
        .footer {
            font-size: 12px;
            color: #999999;
            text-align: center;
            margin-top: 30px;
        }
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }
            .email-container {
                padding: 20px;
            }
            .cta-link {
                display: block;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <p>Hi ${firstName},</p>

        <p>A quick nudge: the 10-lead ceiling is handy for testing, but serious prospecting needs more runway.</p>

        <p>Growth removes the limit. Search as often as you need, whenever ideas strike.</p>

        <p>Those bonus credits I set aside vanish in <span class="urgent">24 hours</span>.</p>

        <p>
            <a href="${process.env.APP_DOMAIN}/user-sequence/${userId}" class="cta-link">Upgrade now (30 sec) →</a>
        </p>

        <p>Need details on how that German firm did it? Let me know and I'll share.</p>

        <div class="signature">
            <p>Best,</p>
            <p><strong>Hafiz</strong><br>
            CEO & Co-founder, LeadRep</p>
        </div>

        <div class="footer">
            <p>© 2023 LeadRep GmbH | <a href="{{unsubscribe_link}}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>`
    );
  } catch (error) {
    logger.error(error, "Error in sequence2:");
    throw error;
  }
};
