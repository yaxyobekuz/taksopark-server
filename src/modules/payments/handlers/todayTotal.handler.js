import asyncHandler from "../../../middleware/asyncHandler.js";
import * as paymentsService from "../services/payments.service.js";

const todayTotal = asyncHandler(async (req, res) => {
  const data = await paymentsService.todayTotal({ date: req.query.date });
  res.json({ success: true, data });
});

export default todayTotal;
