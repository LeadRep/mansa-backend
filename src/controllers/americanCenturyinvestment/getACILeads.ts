import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import logger from "../../logger";

type Lead = {
    id: number;
    name: string;
    title: string; // from LEAD_TITLES
    company: string;
    country: string; // Nordics
    email: string; // masked in preview
    phone: string; // masked in preview
    aum: "0-100M" | "100M-500M" | "500M-2B" | "2B-10B" | "10B-100B" | "100B+";
    companySize: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1001+";
    companySegment: "IFA (Independent Financial Advisors)" |
        "Financial Advisor" |
        "Financial Planner" |
        "CFP (Certified Financial Planner)" |
        "Insurance Broker" |
        "Robo Advisors" |
        "Financial Consultant" |
        "Asset Manager" |
        "Wealth Manager" |
        "Family Office" |
        "Private Banking" |
        "Pension Fund" |
        "Insurance" |
        "Church" |
        "Foundation";
    industry: string; // "Asset Management"
    keywords: string[]; // ["External Manager","Systematic Approach"]
    consumed?: boolean;
};

/** Demo data */
function generateLeads(count = 1000): Lead[] {
    const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const pick = <T,>(arr: T[]) => arr[rnd(0, arr.length - 1)];
    const companies = ["Nordic AM", "Fjord Capital", "Viking Funds", "Northern Advisors", "Aurora AM", "Polar Pension", "Lakeside Family Office", "Saga Foundation"];
    const kwPool = ["External Manager", "Systematic Approach", "Quant", "Long-only", "ESG"];

    return Array.from({ length: count }).map((_, i) => {
        const country = pick(["Finland", "Denmark", "Sweden", "Norway"] as const);
        const name = `John Doe ${i + 1}`;
        const title = pick([
            "Portfolio Manager",
            "Fund manager",
            "CIO",
            "Manager selection",
            "Analyst"
        ]);
        const company = pick(companies);
        const aum = pick(["0-100M" , "100M-500M" , "500M-2B" , "2B-10B" , "10B-100B" , "100B+"] as const);
        const companySize = pick(["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"] as const);
        const companySegment = pick([
            "IFA (Independent Financial Advisors)",
            "Financial Advisor",
            "Financial Planner",
            "CFP (Certified Financial Planner)",
            "Insurance Broker",
            "Robo Advisors",
            "Financial Consultant",
            "Asset Manager",
            "Wealth Manager",
            "Family Office",
            "Private Banking",
            "Pension Fund",
            "Insurance",
            "Church",
            "Foundation"
        ] as const);
        const industry = "Asset Management";
        const email = `${name.toLowerCase().replace(/\\s/g, ".")}@${company.toLowerCase().replace(/\\s/g, "")}.com`;
        const phone = "+358 " + (100000000 + i).toString();
        const consumed = Math.random() < 0.05;
        const keywords = [pick(kwPool), Math.random() > 0.5 ? pick(kwPool) : undefined].filter(Boolean) as string[];
        return { id: i + 1, name, title, company, country, email, phone, aum, companySize, companySegment, industry, keywords, consumed };
    });
}

export const getACILeads = async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;

        const data = generateLeads(1000);
        return sendResponse(response, 200, "leads generated successfully", {
            data
        });
    } catch (error: any) {
        logger.error(error, "Get Organization Error:");
        return sendResponse(response, 500, "Internal Server Error");
    }
};