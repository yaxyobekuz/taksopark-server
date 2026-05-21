import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const monthlyIncomeExpense = asyncHandler(async (_req, res) => {
  const data = await reportsService.monthlyIncomeExpense();
  res.json({ success: true, data });
});

export default monthlyIncomeExpense;
