import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const categoryMonthly = asyncHandler(async (req, res) => {
  const data = await reportsService.categoryMonthly(req.query);
  res.json({ success: true, data });
});

export default categoryMonthly;
