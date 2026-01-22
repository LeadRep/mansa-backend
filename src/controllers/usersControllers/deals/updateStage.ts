// // controllers/usersControllers/deals/updateDealStages.ts
// import { Response } from "express";
// import { JwtPayload } from "jsonwebtoken";
// import sendResponse from "../../../utils/http/sendResponse";
// import Deals from "../../../models/Deals";

// export const updateDealStages = async (request: JwtPayload, response: Response) => {
//   try {
//     const userId = request.user.id;
//     const { dealId } = request.params;
//     const { stages } = request.body;

//     const deal = await Deals.findOne({ where: { userId, id: dealId } });
//     if (!deal) {
//       sendResponse(response, 404, "Deal not found");
//       return;
//     }

//     await deal.update({ stages: JSON.stringify(stages) });
//     sendResponse(response, 200, "Stages updated successfully", stages);
//   } catch (error: any) {
//     logger.info("Error updating deal stages:", error.message);
//     sendResponse(response, 500, "Internal Server Error", null, error.message);
//   }
// };