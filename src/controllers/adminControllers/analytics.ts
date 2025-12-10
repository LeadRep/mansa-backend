import { Request, Response } from "express";
import Users from "../../models/Users";
import Payment from "../../models/Payments";
import { Op, Sequelize } from "sequelize";
import { getSocket } from "../../utils/socket";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Helper: sum active subscriptions from Stripe to compute MRR
export const getMrr = async (req: Request, res: Response) => {
  try {
    // Fetch active subscriptions (limited pagination for MVP)
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
    });
    let currency = "usd";
    let mrrCents = 0;
    subscriptions.data.forEach((sub: any) => {
      const item = sub.items?.data?.[0];
      const price = item?.price;
      if (price) {
        currency = price.currency || currency;
        const unit = price.unit_amount || 0;
        const interval = price.recurring?.interval || "month";
        const monthly = interval === "month" ? unit : unit / 12;
        mrrCents += monthly;
      }
    });

    // Previous month MRR: approximate via Payments table using plan_start_date
    const startOfPrevMonth = new Date();
    startOfPrevMonth.setDate(1);
    startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);
    startOfPrevMonth.setHours(0, 0, 0, 0);
    const endOfPrevMonth = new Date(startOfPrevMonth);
    endOfPrevMonth.setMonth(endOfPrevMonth.getMonth() + 1);

    const payments = await Payment.findAll({
      where: {
        status: "paid",
        plan_start_date: {
          [Op.gte]: startOfPrevMonth,
          [Op.lt]: endOfPrevMonth,
        },
      },
    });

    // attempt to estimate monthly amount from stored session or plan_type mapping
    let prevMrrCents = 0;
    for (const p of payments) {
      const sess = p.session || {};
      const amount = (sess?.amount_total || sess?.amount || 0) as number;
      if (amount) prevMrrCents += amount;
      else {
        // fallback: try to infer from plan_type strings (e.g., 'Basic-Monthly')
        const pt = p.plan_type || "";
        if (pt.includes("Monthly")) {
          // amount unknown — skip
        }
      }
    }

    const mrr = +(mrrCents / 100).toFixed(2);
    const prevMrr = +(prevMrrCents / 100).toFixed(2);
    const growth =
      prevMrr === 0 ? null : +(((mrr - prevMrr) / prevMrr) * 100).toFixed(2);

    return res.json({
      success: true,
      data: { mrr, currency, prevMrr, growth },
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getArr = async (req: Request, res: Response) => {
  try {
    // Reuse MRR calculation via Stripe for accuracy
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
    });
    let arrCents = 0;
    subscriptions.data.forEach((sub: any) => {
      const item = sub.items?.data?.[0];
      const price = item?.price;
      if (price) {
        const unit = price.unit_amount || 0;
        const interval = price.recurring?.interval || "month";
        const annual = interval === "year" ? unit : unit * 12;
        arrCents += annual;
      }
    });
    return res.json({
      success: true,
      data: { arr: +(arrCents / 100).toFixed(2) },
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserMetrics = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalUsers = await Users.count();
    
    // Use raw query for created_at since it's a timestamp not in UsersAttributes
    const thisMonthResult = await Users.count({
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("created_at")),
            Op.gte,
            startOfThisMonth.toISOString().split("T")[0]
          ),
        ],
      } as any,
    });
    
    const lastMonthResult = await Users.count({
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("created_at")),
            Op.gte,
            startOfLastMonth.toISOString().split("T")[0]
          ),
          Sequelize.where(
            Sequelize.fn("DATE", Sequelize.col("created_at")),
            Op.lt,
            endOfLastMonth.toISOString().split("T")[0]
          ),
        ],
      } as any,
    });

    const thisMonth = thisMonthResult;
    const lastMonth = lastMonthResult;
    const growthRate =
      lastMonth === 0
        ? null
        : +(((thisMonth - lastMonth) / lastMonth) * 100).toFixed(2);

    return res.json({
      success: true,
      data: { totalUsers, thisMonth, lastMonth, growthRate },
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubscribedUsers = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const count = await Users.count({
      where: { subscriptionEndDate: { [Op.gt]: now } },
    });
    return res.json({ success: true, data: { subscribedUsers: count } });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGeo = async (req: Request, res: Response) => {
  try {
    const results = await Users.findAll({
      attributes: [
        [Sequelize.col("country"), "country"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
      ],
      group: ["country"],
      order: [[Sequelize.literal("count"), "DESC"]],
      limit: 20,
    });
    return res.json({ success: true, data: results });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveUsersByOrg = async (req: Request, res: Response) => {
  try {
    const io = getSocket();
    const sockets = io.sockets.sockets;
    const userIds = new Set<string>();
    sockets.forEach((s: any) => {
      if (s.data?.userId) userIds.add(s.data.userId as string);
    });

    // Map userIds to org ids
    const users = await Users.findAll({
      where: { id: Array.from(userIds) },
      attributes: ["id", "organization_id"],
    });
    const counts: Record<string, number> = {};
    users.forEach((u: any) => {
      const org = u.organization_id || "unknown";
      counts[org] = (counts[org] || 0) + 1;
    });

    return res.json({ success: true, data: { activeByOrg: counts } });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
