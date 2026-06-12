import asyncHandler from "../../../middleware/asyncHandler.js";
import * as dailyPlansService from "../services/dailyPlans.service.js";

const getPlan = asyncHandler(async (req, res) => {
  const data = await dailyPlansService.getPlanById(req.params.id);
  res.json({ success: true, data });
});

export default getPlan;
