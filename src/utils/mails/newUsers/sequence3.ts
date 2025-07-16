import { sendEmail } from "../../../configs/email/emailConfig";
import dotenv from "dotenv";

dotenv.config();
export const sequence3 = async (
  to: string,
  firstName: string,
  userId: string
) => {
  try {
    await sendEmail(
      to,
      "⏳ Bonus credits vanish at midnight",
      ``,
      `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⏳ Bonus credits vanish at midnight</title>
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
        .benefits {
            margin: 20px 0;
            padding-left: 20px;
        }
        .benefits li {
            margin-bottom: 10px;
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

        <p class="urgent">Last call: the extra credits disappear tonight.</p>

        <p>Growth gives you:</p>
        
        <ul class="benefits">
            <li><strong>Unlimited lead searches</strong>—no quotas, ever</li>
            <li><strong>Immediate CSV export</strong> to jump-start outreach</li>
            <li><strong>Priority support</strong> for anything you need</li>
        </ul>

        <p>Same upgrade the German team used before building <span class="highlight">€587,000 in 30 days</span>.</p>

        <div style="text-align: center;">
            <a href="${process.env.APP_DOMAIN}/user-sequence/${userId}" class="cta-link">👉 Upgrade now →</a>
        </div>

        <p>If you pass, no worries—you'll still keep your 10-lead trial.</p>

        <p>But I'd love to see what you do with a full pipeline.</p>

        <div class="signature">
            <p>Thanks for trying LeadRep,</p>
            <p><strong>Hafiz</strong><br>
            CEO & Co-founder, LeadRep</p>
        </div>

        <div class="footer">
            <p>© 2023 LeadRep GmbH | <a href="{{unsubscribe_link}}" style="color: #999999;">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>`
    );
  } catch (error) {
    console.error("Error in sequence3:", error);
    throw error;
  }
};
