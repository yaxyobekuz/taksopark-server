import asyncHandler from "../../../middleware/asyncHandler.js";
import * as dailyPlansService from "../services/dailyPlans.service.js";

const monthView = asyncHandler(async (req, res) => {
  const { driverId, year, month } = req.query;
  const data = await dailyPlansService.monthView({ driverId, year, month });
  res.json({ success: true, data });
});

export default monthView;
