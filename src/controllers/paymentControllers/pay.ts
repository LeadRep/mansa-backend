import { Response } from "express";
import Users from "../../models/Users";
import dotenv from "dotenv";
import { JwtPayload } from "jsonwebtoken";
import Payment from "../../models/Payments";
import { v4 } from "uuid";
import moment from "moment";
import { findLeads } from "../aiControllers/findLeads";
import sendResponse from "../../utils/http/sendResponse";
import NewUsersSequence from "../../models/NewUsersSequence";

dotenv.config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

export const stripeSession = async (plan: string) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      line_items: [
        {
          price: plan,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_DOMAIN}/successful-payment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_DOMAIN}/cancel-payment`,
    });
    return session;
  } catch (error: any) {
    return error;
  }
};

export const payment = async (request: JwtPayload, response: Response) => {
  let basicMonthly = "";
  let basicYearly = "";
  let growthMonthly = "";
  let growthYearly = "";
  let teamMonthly = "";
  let teamYearly = "";
  if (process.env.APP_ENV === "poduction") {
    basicMonthly = "price_1RP4cyJlttlFevLMsbWAahtg";
    basicYearly = "price_1RP4cyJlttlFevLMigbEa2Ek";
    growthMonthly = "price_1RP4eaJlttlFevLMuVo2zImh";
    growthYearly = "price_1RP4fEJlttlFevLM5tegvdNR";
    teamMonthly = "price_1RP4gmJlttlFevLMFNFLAZZU";
    teamYearly = "price_1RP4hGJlttlFevLMmtLHoqaO";
  } else {
    basicMonthly = "price_1RP3rtQwj7e0FQ8k5TRLrFOD";
    basicYearly = "price_1RP3w8Qwj7e0FQ8k0PK1ynTJ";
    growthMonthly = "price_1RP3q5Qwj7e0FQ8kVLcj6rRv";
    growthYearly = "price_1RP3xSQwj7e0FQ8kZYhFJdhn";
    teamMonthly = "price_1RP3teQwj7e0FQ8kvtBp90BN";
    teamYearly = "price_1RP3v0Qwj7e0FQ8k7retS6kE";
  }

  const userId = request.user?.id;
  const { plan } = request.body;

  let planId = "";

  if (plan == 14) planId = basicMonthly;
  else if (plan == 150) planId = basicYearly;
  else if (plan == 29) planId = growthMonthly;
  else if (plan == 300) planId = growthYearly;
  else if (plan == 99) planId = teamMonthly;
  else if (plan == 1000) planId = teamYearly;

  try {
    const session = await stripeSession(planId);
    await Payment.create({
      id: v4(),
      user_id: userId,
      session,
      session_id: session.id,
      plan_id: planId,
      plan_type: ``,
      status: ``,
      plan_start_date: new Date(),
      plan_end_date: new Date(),
      plan_duration: ``,
    });
    response.json({ session });
    return;
  } catch (error: any) {
    console.log(error.message);
    response.status(500).json({
      status: `error`,
      method: request.method,
      message: error.message,
    });
    return;
  }
};

export const successPayment = async (
  request: JwtPayload,
  response: Response
) => {
  const userId = request.user?.id;
  const sessionID = request.body.sessionId;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionID);
    if (session.payment_status === "paid") {
      const subscriptionId = session.subscription;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const planId = subscription.plan.id;

      let planType = "";
      if (subscription.plan.amount === 1400) planType = "Basic-Monthly";
      if (subscription.plan.amount === 15000) planType = "Basic-Yearly";
      if (subscription.plan.amount === 2900) planType = "Growth-Monthly";
      if (subscription.plan.amount === 30000) planType = "Growth-Yearly";
      if (subscription.plan.amount === 9900) planType = "Team-Monthly";
      if (subscription.plan.amount === 100000) planType = "Team-Yearly";

      const startDate = new Date(
        moment.unix(subscription.start_date).toDate().toISOString()
      );
      let endDate: Date;
      if (subscription.plan.interval === "month") {
        endDate = moment(startDate).add(1, "month").toDate();
      } else {
        endDate = moment(startDate).add(1, "year").toDate();
      }
      const durationInMilliseconds = endDate.getTime() - startDate.getTime();
      const durationInDays = moment
        .duration(durationInMilliseconds, "milliseconds")
        .asDays();

      await Payment.update(
        {
          session,
          plan_id: planId,
          plan_type: planType,
          status: session.payment_status,
          plan_start_date: startDate,
          plan_end_date: endDate,
          plan_duration: String(durationInDays),
          customer_id: subscription.customer,
        },
        { where: { session_id: sessionID } }
      );
      await Users.update(
        {
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          subscriptionName: planType,
        },
        {
          where: {
            id: userId,
          },
        }
      );
      const userInSequence = await NewUsersSequence.findOne({
        where: { user_id: userId },
      });
      if (userInSequence) {
        await NewUsersSequence.destroy({ where: { user_id: userId } });
      }
      const userDetails = await Users.findOne({ where: { id: userId } });
      const userResponse = { ...userDetails?.get(), password: undefined };

      sendResponse(response, 200, "Payment Successful", { user: userResponse });
      findLeads(userId, 24);
      return;
    } else {
      response.json({
        status: `error`,
        message: "Payment failed",
      });
      return;
    }
  } catch (error: any) {
    console.log(error.message);
    response.status(500).json({
      status: `error`,
      message: `Something went wrong`,
    });
    return;
  }
};

export const customerPortal = async (
  request: JwtPayload,
  response: Response
) => {
  try {
    const email = request.body.email;

    const customer = await stripe.customers.list({ email: email });
    const customerId = customer.data[0].id;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `https://${process.env.DOMAIN}/alldashboards`,
    });
    if (session.url) {
      return response.status(200).json({
        status: `success`,
        message: "Navigating to Customer Portal",
        url: session.url,
      });
    } else {
      return response.status(400).json({
        status: `error`,
        message: "Unable to access Customer Portal, please login",
      });
    }
  } catch (error: any) {
    console.log(error.message);
    return response.status(500).json({
      status: `error`,
      message: `Something went wrong, Please try again`,
    });
  }
};
