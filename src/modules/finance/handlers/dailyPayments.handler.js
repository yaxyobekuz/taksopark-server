import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reports from "../services/reports.service.js";

const dailyPayments = asyncHandler(async (req, res) => {
  const data = await reports.dailyPlansForMonth({ year: req.query.year, month: req.query.month });
  res.json({ success: true, data });
});

export const dailyPaymentsByDate = asyncHandler(async (req, res) => {
  const data = await reports.dailyPlansForDate({ date: req.query.date });
  res.json({ success: true, data });
});

export default dailyPayments;
