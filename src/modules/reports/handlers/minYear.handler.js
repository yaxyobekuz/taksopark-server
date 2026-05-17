import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const minYear = asyncHandler(async (_req, res) => {
  const data = await reportsService.minYear();
  res.json({ success: true, data });
});

export default minYear;
