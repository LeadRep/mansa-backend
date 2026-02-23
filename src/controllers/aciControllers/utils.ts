import {GeneralLeadsAttributes} from "../../models/GeneralLeads";
import logger from "../../logger";

export type PlainLead = GeneralLeadsAttributes & {
    organization?: any;
    createdAt?: Date;
    updatedAt?: Date;
};

const coerceJSON = (value: unknown, name: string): Record<string, any> | null => {
    if (!value) {
        return null;
    }

    if (typeof value === "object") {
        return value as Record<string, any>;
    }

    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch (error) {
            logger.warn(
                { error: (error as Error)?.message },
                `Unable to parse ${name} payload for lead`
            );
            return null;
        }
    }

    return null;
};

const getCompanySizeRange = (size?: number) => {
    if (!size) return "-";
    if (size < 10) return "<10";
    if (size < 100) return "10-99";
    if (size < 1000) return "100-999";
    return "1000+";
}

export const normalizeLead = (lead: PlainLead) => {
    const organization = coerceJSON(lead.organization, "organization");
    const aumJson = coerceJSON(lead.aum, "aum");
    const individualSegmentsJSON = coerceJSON(lead.individual_segments, "segments");
    const organizationName =
        organization?.name ??
        organization?.organization_name ??
        organization?.company ??
        null;

    const organizationCountry =
        organization?.country ??
        organization?.organization_country ??
        organization?.location ??
        null;

    const aum = (aumJson?.value && aumJson?.currency)
        ? `${aumJson.value} ${aumJson.currency}`.trim()
        : null;

    const companySize =
        getCompanySizeRange(organization?.estimated_num_employees) ??
        organization?.employee_count_range ??
        organization?.organization_size ??
        organization?.company_size ??
        null;

    const companySegment =
        lead.segments ??
        organization?.category ??
        organization?.segment ??
        organization?.company_segment ??
        null;

    const keywords: string[] = Array.isArray(organization?.keywords)
        ? organization?.keywords
        : [];

    return {
        id: lead.id,
        externalId: lead.external_id,
        name: lead.full_name ?? lead.name ?? organizationName ?? null,
        title: lead.title ?? null,
        company: organizationName,
        country: organizationCountry,
        email: lead.email ?? organization?.email ?? null,
        phone: lead.phone ?? organization?.phone ?? null,
        aum: aum,
        aumJson: aumJson,
        companySize,
        companySegment,
        industry: organization?.industry ?? null,
        keywords,
        city: organization?.city ?? null,
        state: lead.state ?? organization?.state ?? null,
        linkedinUrl: lead.linkedin_url ?? null,
        organization,
        updatedAt: lead.updatedAt ?? null,
        createdAt: lead.createdAt ?? null,
        consumed: Boolean(!lead.revealed_for_current_team),
        individualSegments: individualSegmentsJSON
    };
};