import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import axios from "axios";
import { CustomerPref } from "../../models/CustomerPref";
import { organizationSearch } from "../../utils/services/apollo/organizationSearch";
import { orgSearchQueryPrompt } from "../../utils/services/ai/orgSearchQueryPrompt";
import { peopleSearch } from "../../utils/services/apollo/peopleSearch";
import { peopleSearchQueryPrompt } from "../../utils/services/ai/peopleSearchQueryPrompt";

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

const getCustomerPrefByUserId = async (userId: string) => {
  const pref = await CustomerPref.findOne({ where: { userId } });
  if (!pref) throw new Error("Customer preferences not found");
  return pref;
};

export const findPeople = async (req: Request, res: Response) => {
  try {
    // const poepleFound = await peopleSearch(
    //   { person_titles: ["CEO", "software engineer"] },
    //   1
    // );

    // const enrichAPerson = await enrichPerson({
    //   id: "54a29a9e7468693cdd7a5a2f",
    // });

    // const bulkPeople = await enrichPeople({
    //   details: [
    //     { id: "54a29a9e7468693cdd7a5a2f" },
    //     { id: "54a32c917468693318819259" },
    //     { id: "54a406f97468693b8c0e3e26" },
    //   ],
    // });
    // const action = await organizationSearch(
    //   { q_organization_keyword_tags: ["fintech"] },
    //   1
    // );
    // console.log(action);
    const userInfo = await getCustomerPrefByUserId(
      "04149691-d7a6-4d5c-9130-e81f6c4a3d9f"
    );
    const orgSearchQuery = await orgSearchQueryPrompt(userInfo);
    const organizations = await organizationSearch(orgSearchQuery, 10);
    const organizationPages = organizations.pagination.total_pages;
    console.log(organizationPages);
    // const peopleSearchQuery = await peopleSearchQueryPrompt(userInfo);
    // const people = await peopleSearch(
    //   { ...peopleSearchQuery, organization_ids: organizations.model_ids },
    //   1
    // );
    sendResponse(res, 200, "Leads found successfully", organizations);
  } catch (error: any) {
    console.log(error.message);
    sendResponse(res, 500, "Internal Server Error", error.message);
  }
};
