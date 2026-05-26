import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const depositDriversMonthly = asyncHandler(async (req, res) => {
  const { year, month, driverId } = req.query;
  const data = await reportsService.depositDriversMonthly({ year, month, driverId });
  res.json({ success: true, data });
});

export default depositDriversMonthly;
