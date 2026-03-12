import { ApolloPerson } from "./types";

export const filterLowQualityLeads = (people: ApolloPerson[]) => {
  return people.filter((lead) => {
    const hasEmail = Boolean(lead?.email);
    const hasTitle = Boolean(lead?.title);
    const hasLinkedin = Boolean(lead?.linkedin_url);
    const hasOrganization = Boolean(lead?.organization);

    return hasEmail || hasTitle || hasLinkedin || hasOrganization;
  });
};
