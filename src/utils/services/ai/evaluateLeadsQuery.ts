<<<<<<< HEAD
import axios from "axios";
import { v4 } from "uuid";
import { Leads } from "../../../models/Leads";
import logger from "../../../logger";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

export const evaluateLeadsWithAI = async (
  customerPref: any,
  leads: any[],
  userId: string // Add userId as a parameter
) => {
  const results = [];
  logger.info(`${leads.length} leads to evaluate`);

  for (const lead of leads) {
    const leadExist = await Leads.findOne({
      where: { owner_id: userId, external_id: lead.id },
    });
    if (!leadExist) {
      const messages = [
        {
          role: "system",
          content:
            "You are a helpful assistant that evaluates leads and returns a single JSON object. Do not include explanations. Ensure the JSON is valid with double-quoted property names.",
        },
        {
          role: "user",
          content: `Based on this Ideal Customer Profile (ICP) and Buyer Persona (BP):

        ICP: ${JSON.stringify(customerPref.ICP)}
        BP: ${JSON.stringify(customerPref.BP)}

        Evaluate this lead:
        ${JSON.stringify(lead)}

        Return a JSON object with all the lead's existing information and add these fields:
        - id
        - first_name
        - last_name
        - full_name
        - linkedin_url
        - title
        - photo_url
        - twitter_url
        - github_url
        - facebook_url
        - headline
        - email
        - phone
        - organization
        - departments
        - state
        - city
        - country
        - category (one of: "fit", "high score", "news", "event")
        - reason (why this lead is a good fit)
        - score (0 to 100 likelihood of becoming a customer)
        - net_worth (approximate)

        Only return a valid JSON object. No extra text.`,
        },
      ];

      try {
        const response = await axios.post(
          endpoint!,
          {
            messages,
            temperature: 0.7,
            max_tokens: 2000,
            model: "gpt-4",
          },
          {
            headers: {
              "api-key": apiKey!,
              "Content-Type": "application/json",
            },
          }
        );

        let content: string =
          response?.data?.choices?.[0]?.message?.content?.trim() ?? "";

        // Remove Markdown wrappers
        content = content
          .replace(/^```(json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        try {
          const parsedLead = JSON.parse(content);
          results.push(parsedLead);

          // Save to database
          const leadExist = await Leads.findOne({
            where: { owner_id: userId, external_id: parsedLead.id },
          });
          if (!leadExist) {
            await Leads.create({
              id: v4(),
              external_id: parsedLead.id,
              owner_id: userId,
              first_name: parsedLead.first_name,
              last_name: parsedLead.last_name,
              full_name: parsedLead.full_name,
              linkedin_url: parsedLead.linkedin_url,
              title: parsedLead.title,
              photo_url: parsedLead.photo_url,
              twitter_url: parsedLead.twitter_url,
              github_url: parsedLead.github_url,
              facebook_url: parsedLead.facebook_url,
              headline: parsedLead.headline,
              email: parsedLead.email,
              phone: parsedLead.phone,
              organization: parsedLead.organization,
              departments: parsedLead.departments,
              state: parsedLead.state,
              city: parsedLead.city,
              country: parsedLead.country,
              category: parsedLead.category,
              reason: parsedLead.reason,
              score: parsedLead.score,
            });
          }
        } catch (parseErr: any) {
          logger.error( parseErr,
            `JSON parse failed for lead: ${lead.email ?? "unknown"}`
          );
          logger.info(`Raw content:\n${content}`);

          // Try to fix common JSON issues
          try {
            const fixedContent = content.replace(
              /([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g,
              '$1"$2"$3'
            );
            const parsedLead = JSON.parse(fixedContent);
            results.push(parsedLead);

            // Save to database
            const leadExist = await Leads.findOne({
              where: { owner_id: userId, external_id: parsedLead.id },
            });
            if (!leadExist) {
              await Leads.create({
                id: v4(),
                external_id: parsedLead.id,
                owner_id: userId,
                first_name: parsedLead.first_name,
                last_name: parsedLead.last_name,
                full_name: parsedLead.full_name,
                linkedin_url: parsedLead.linkedin_url,
                title: parsedLead.title,
                photo_url: parsedLead.photo_url,
                twitter_url: parsedLead.twitter_url,
                github_url: parsedLead.github_url,
                facebook_url: parsedLead.facebook_url,
                headline: parsedLead.headline,
                email: parsedLead.email,
                phone: parsedLead.phone,
                organization: parsedLead.organization,
                departments: parsedLead.departments,
                state: parsedLead.state,
                city: parsedLead.city,
                country: parsedLead.country,
                category: parsedLead.category,
                reason: parsedLead.reason,
                score: parsedLead.score,
              });
            }
          } catch (fixErr: any) {
            logger.error(fixErr, "Failed to recover JSON:");
            results.push({
              ...lead,
              category: "unknown",
              reason: "Could not parse AI response",
              score: 0,
              parseError: parseErr.message,
            });
          }
        }
      } catch (err: any) {
        logger.error(err, `API error for lead ${lead.email ?? "unknown"}:`);
        results.push({
          ...lead,
          category: "unknown",
          reason: "AI API request failed",
          score: 0,
          apiError: err.message,
        });
      }
    }
  }

  return results;
};
=======
import { v4 } from "uuid";
import { Leads } from "../../../models/Leads";
import logger from "../../../logger";
import { aiService } from "../../http/services/aiService";

export const evaluateLeadsWithAI = async (
  customerPref: any,
  leads: any[],
  userId: string // Add userId as a parameter
) => {
  const results = [];
  logger.info(`${leads.length} leads to evaluate`);

  for (const lead of leads) {
    const leadExist = await Leads.findOne({
      where: { owner_id: userId, external_id: lead.id },
    });
    if (!leadExist) {
      const messages = [
        {
          role: "system",
          content:
            "You are a helpful assistant that evaluates leads and returns a single JSON object. Do not include explanations. Ensure the JSON is valid with double-quoted property names.",
        },
        {
          role: "user",
          content: `Based on this Ideal Customer Profile (ICP) and Buyer Persona (BP):

        ICP: ${JSON.stringify(customerPref.ICP)}
        BP: ${JSON.stringify(customerPref.BP)}

        Evaluate this lead:
        ${JSON.stringify(lead)}

        Return a JSON object with all the lead's existing information and add these fields:
        - id
        - first_name
        - last_name
        - full_name
        - linkedin_url
        - title
        - photo_url
        - twitter_url
        - github_url
        - facebook_url
        - headline
        - email
        - phone
        - organization
        - departments
        - state
        - city
        - country
        - category (one of: "fit", "high score", "news", "event")
        - reason (why this lead is a good fit)
        - score (0 to 100 likelihood of becoming a customer)
        - net_worth (approximate)

        Only return a valid JSON object. No extra text.`,
        },
      ];

      try {
        const response = await aiService.request(
          {
            messages,
            temperature: 0.7,
            max_tokens: 2000,
            model: "gpt-4",
          }
        );

        try {
          const parsedLead = response.data;
          results.push(parsedLead);

          // Save to database
          const leadExist = await Leads.findOne({
            where: { owner_id: userId, external_id: parsedLead.id },
          });
          if (!leadExist) {
            await Leads.create({
              id: v4(),
              external_id: parsedLead.id,
              owner_id: userId,
              first_name: parsedLead.first_name,
              last_name: parsedLead.last_name,
              full_name: parsedLead.full_name,
              linkedin_url: parsedLead.linkedin_url,
              title: parsedLead.title,
              photo_url: parsedLead.photo_url,
              twitter_url: parsedLead.twitter_url,
              github_url: parsedLead.github_url,
              facebook_url: parsedLead.facebook_url,
              headline: parsedLead.headline,
              email: parsedLead.email,
              phone: parsedLead.phone,
              organization: parsedLead.organization,
              departments: parsedLead.departments,
              state: parsedLead.state,
              city: parsedLead.city,
              country: parsedLead.country,
              category: parsedLead.category,
              reason: parsedLead.reason,
              score: parsedLead.score,
            });
          }
        } catch (parseErr: any) {
          logger.error( parseErr,
            `JSON parse failed for lead: ${lead.email ?? "unknown"}`
          );
          logger.info(`Raw content:\n${JSON.stringify(response.data)}`);

          // Try to fix common JSON issues
          try {
            const fixedContent = response.data.replace(
              /([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g,
              '$1"$2"$3'
            );
            const parsedLead = JSON.parse(fixedContent);
            results.push(parsedLead);

            // Save to database
            const leadExist = await Leads.findOne({
              where: { owner_id: userId, external_id: parsedLead.id },
            });
            if (!leadExist) {
              await Leads.create({
                id: v4(),
                external_id: parsedLead.id,
                owner_id: userId,
                first_name: parsedLead.first_name,
                last_name: parsedLead.last_name,
                full_name: parsedLead.full_name,
                linkedin_url: parsedLead.linkedin_url,
                title: parsedLead.title,
                photo_url: parsedLead.photo_url,
                twitter_url: parsedLead.twitter_url,
                github_url: parsedLead.github_url,
                facebook_url: parsedLead.facebook_url,
                headline: parsedLead.headline,
                email: parsedLead.email,
                phone: parsedLead.phone,
                organization: parsedLead.organization,
                departments: parsedLead.departments,
                state: parsedLead.state,
                city: parsedLead.city,
                country: parsedLead.country,
                category: parsedLead.category,
                reason: parsedLead.reason,
                score: parsedLead.score,
              });
            }
          } catch (fixErr: any) {
            logger.error(fixErr, "Failed to recover JSON:");
            results.push({
              ...lead,
              category: "unknown",
              reason: "Could not parse AI response",
              score: 0,
              parseError: parseErr.message,
            });
          }
        }
      } catch (err: any) {
        logger.error(err, `API error for lead ${lead.email ?? "unknown"}:`);
        results.push({
          ...lead,
          category: "unknown",
          reason: "AI API request failed",
          score: 0,
          apiError: err.message,
        });
      }
    }
  }

  return results;
};
>>>>>>> master
