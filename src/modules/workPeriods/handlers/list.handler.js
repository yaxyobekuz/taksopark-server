import asyncHandler from "../../../middleware/asyncHandler.js";
import * as workPeriodsService from "../services/workPeriods.service.js";

const list = asyncHandler(async (req, res) => {
  const data = await workPeriodsService.list(req.query.driverId);
  res.json({ success: true, data });
});

export default list;
