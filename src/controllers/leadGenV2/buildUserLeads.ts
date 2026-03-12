import { LeadStatus } from "../../models/Leads";
import { ApolloPerson } from "./types";
import { IntroMailSender, normalizeIntroMail } from "../leadsController/introMail";

export const buildUserLeads = (
  userId: string,
  people: ApolloPerson[],
  evaluationResults: any[],
  customerPref: any,
  sender?: IntroMailSender | null
) => {
  const scoredLeads = people.reduce((acc: any[], lead: any) => {
    const aiScore = evaluationResults.find((item: any) => item.id === lead.id);
    if (!aiScore) {
      return acc;
    }

    acc.push({
      external_id: lead.id,
      owner_id: userId,
      first_name: lead.first_name ?? null,
      last_name: lead.last_name ?? null,
      full_name: lead.name ?? lead.full_name ?? null,
      linkedin_url: lead.linkedin_url ?? null,
      title: lead.title ?? null,
      photo_url: lead.photo_url ?? null,
      twitter_url: lead.twitter_url ?? null,
      github_url: lead.github_url ?? null,
      facebook_url: lead.facebook_url ?? null,
      headline: lead.headline ?? null,
      email: lead.email ?? null,
      phone: lead.phone_numbers?.[0]?.number ?? lead.phone ?? null,
      organization: lead.organization ?? null,
      departments: lead.departments ?? null,
      state: lead.state ?? null,
      city: lead.city ?? null,
      country: lead.country ?? null,
      category: aiScore.category ?? null,
      reason: aiScore.reason ?? null,
      score: aiScore.score ?? null,
      intro_mail: normalizeIntroMail(aiScore.intro_mail, lead, customerPref, sender),
      status: LeadStatus.NEW,
      views: 1,
    });

    return acc;
  }, []);

  return scoredLeads;
};
