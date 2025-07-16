import { sendEmail } from "../../../configs/email/emailConfig";
import dotenv from "dotenv";

dotenv.config();
export const sequence1 = async(to: string, firstName: string, userId: string) => {
  try {
    await sendEmail(
      to,
      `${firstName}, see how €587,000 pipeline started with 10 leads`,
      ``,
      `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{first_name}}, see how €587,000 pipeline started with 10 leads</title>
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
        .quote {
            border-left: 3px solid #00CFC7;
            padding-left: 15px;
            font-style: italic;
            margin: 20px 0;
            color: #555555;
        }
        .highlight {
            color: #0177D2;
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
            margin: 20px 0;
        }
        .signature {
            margin-top: 30px;
            border-top: 1px solid #eeeeee;
            padding-top: 20px;
        }
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }
            .email-container {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <p>Hi ${firstName},</p>

        <p>Last month a Head of Marketing at a mid-size German consultancy was out of fresh prospects.</p>

        <div class="quote">
            "Our list is dead. We need real conversations, fast."
        </div>

        <p>She signed up for LeadRep and ran her first <span class="highlight">10 free searches</span>, just like you did.</p>

        <p>Then she upgraded and spent an afternoon pulling as many targeted contacts as she wanted—no caps, no extra cost.</p>

        <p><span class="highlight">Thirty days later:</span> her team was working <span class="highlight">€587,000 in new pipeline.</span></p>

        <p>No magic. No cold spreadsheet buys. Just unlimited searches plus focused outreach.</p>

        <p>If you'd like to try the same play, upgrade to <span class="highlight">Growth</span>.</p>

        <p>I've added bonus credits that disappear in <span class="highlight">48 hours</span>:</p>

        <p>
            <a href="${process.env.APP_DOMAIN}/user-sequence/${userId}" class="cta-link">Grab them here (30-second upgrade) →</a>
        </p>

        <p>Any questions? Hit reply and it lands in my inbox.</p>

        <div class="signature">
            <p>Cheers,</p>
            <p><strong>Hafiz</strong><br>
            CEO & Co-founder, LeadRep</p>
        </div>
    </div>
</body>
</html>`
    );
  } catch (error) {
    console.error("Error in sequence1:", error);
    throw error;
  }
};
