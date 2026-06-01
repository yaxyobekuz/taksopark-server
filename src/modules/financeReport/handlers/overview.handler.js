import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/financeReport.service.js";

const overview = asyncHandler(async (req, res) => {
  const data = await service.overview(req.query);
  res.json({ success: true, data });
});

export default overview;
