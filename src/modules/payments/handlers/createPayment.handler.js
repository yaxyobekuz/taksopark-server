import asyncHandler from "../../../middleware/asyncHandler.js";
import * as transactionsService from "../services/transactions.service.js";

const createPayment = asyncHandler(async (req, res) => {
  const { dailyPlanId, amount, note } = req.body;
  const data = await transactionsService.createPayment(dailyPlanId, { amount, note }, req.user);
  res.status(201).json({ success: true, data, message: "To'lov qabul qilindi" });
});

export default createPayment;
