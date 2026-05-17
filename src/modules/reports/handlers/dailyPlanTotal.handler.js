import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const dailyPlanTotal = asyncHandler(async (req, res) => {
  const data = await reportsService.dailyPlanTotal({ date: req.query.date });
  res.json({ success: true, data });
});

export default dailyPlanTotal;
