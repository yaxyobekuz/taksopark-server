import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/financeReport.service.js";

const integrity = asyncHandler(async (_req, res) => {
  const data = await service.integrity();
  res.json({ success: true, data });
});

export default integrity;
