import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const dailyIncomeExpense = asyncHandler(async (req, res) => {
  const days = req.query.days || 30;
  const data = await reportsService.dailyIncomeExpense({ days });
  res.json({ success: true, data });
});

export default dailyIncomeExpense;
