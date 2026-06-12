import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reports from "../services/reports.service.js";

const overview = asyncHandler(async (req, res) => {
  const data = await reports.overview({ year: req.query.year, month: req.query.month });
  res.json({ success: true, data });
});

export default overview;
