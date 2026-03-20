import { Request, Response } from "express";
import sendResponse from "../../utils/http/sendResponse";
import { aiClassifyLead } from "../aiControllers/testSegmentation";
import logger from "../../logger";
import { Op } from "sequelize";
import {ACILeads} from "../../models/ACILeads";

// Map JSON operator names to Sequelize Ops
const OP_MAP: Record<string, symbol> = {
  iLike: Op.iLike,
  like: Op.like,
  in: Op.in,
  notIn: Op.notIn,
  gt: Op.gt,
  gte: Op.gte,
  lt: Op.lt,
  lte: Op.lte,
  ne: Op.ne,
  eq: Op.eq,
  or: Op.or,
  and: Op.and,
};

// Recursively convert JSON-safe filter into Sequelize where
function buildWhereFromBody(payload: any): any {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const keys = Object.keys(payload);
  // top-level OR/AND arrays
  if (keys.length === 1 && (keys[0] === "or" || keys[0] === "and") && Array.isArray(payload[keys[0]])) {
    return { [OP_MAP[keys[0]]]: payload[keys[0]].map((p: any) => buildWhereFromBody(p)) };
  }

  const where: Record<string | symbol, any> = {};
  for (const key of keys) {
    const value = payload[key];

    // if key is a logical operator at this level
    if ((key === "or" || key === "and") && Array.isArray(value)) {
      where[OP_MAP[key]] = value.map((p: any) => buildWhereFromBody(p));
      continue;
    }

    // if value is an object with operator keys: { title: { iLike: '%x%' } }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const innerKeys = Object.keys(value);
      const hasOp = innerKeys.some((k) => OP_MAP[k] !== undefined);

      if (hasOp) {
        where[key] = {};
        for (const ik of innerKeys) {
          if (OP_MAP[ik]) {
            where[key][OP_MAP[ik]] = buildWhereFromBody(value[ik]);
          } else {
            // treat unknown inner key as literal value
            where[key][ik] = buildWhereFromBody(value[ik]);
          }
        }
      } else {
        // nested JSON / direct equality object -> pass through (or recurse for deeper levels)
        where[key] = buildWhereFromBody(value);
      }
    } else {
      // primitive or array -> direct equality / IN
      where[key] = value;
    }
  }

  return where;
}

export const classifyLeads = async (req: Request, res: Response) => {
  try {
    //const where = buildWhereFromBody(req.body);
    //console.log(`RVRV ${JSON.stringify(where)}`)
    const leadRecord = await ACILeads.findOne({
      where: {
        //id: userId ,
        individual_segments: null,
        priority: 2,
      //   title: {
      //     [Op.iLike]: '%ortfolio manager%'
      //   },
        // title: {
        //   [Op.iLike]: '%Wealth manager%'
        // },
        // title: {
        //   [Op.iLike]: '%CIO%'
        // },
        // title: {
        //   [Op.iLike]: '%chief inves%'
        // },
        // title: {
        //   [Op.iLike]: '%head of%'
        // },
        // title: {
        //   [Op.iLike]: '%fund%'
        // },

        // title: {
        //   [Op.iLike]: '%family off%'
        // },
        // title: {
        //   [Op.iLike]: '%asset%'
        // },

       },
      order: [["createdAt", "DESC"]],
    })
    if (!leadRecord) {
      sendResponse(res, 202, "No leads to classify", []);
      return;
    }

    // console.log(`RVRV ${JSON.stringify(leadRecord)}`)
    const lead = leadRecord!!.get({ plain: true })
    console.log(`RVRV ${JSON.stringify(lead)}`)

    //console.log(lead);

    try {
      const result = await aiClassifyLead(lead);
      leadRecord?.update(
        { individual_segments: result }
      )
      sendResponse(res, 200, "Leads classifiy", result);

    } catch (error: any) {
      const segError = { error: error?.message ?? JSON.stringify(error) };
      leadRecord?.update(
        { individual_segments: segError as any }
      )
      logger.error("something went wrong with the ai classification", error);
      sendResponse(res, 500, "AI classification failed", null, error.message);
    }

    //console.log("result")
    //console.log(result);


    return;
  } catch (error: any) {
    logger.error(error, "Error");
    sendResponse(res, 500, "Internal server error", null, error.message);
    return;
  }
};
