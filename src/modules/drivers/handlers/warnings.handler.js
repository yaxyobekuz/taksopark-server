import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const warnings = asyncHandler(async (_req, res) => {
  const data = await driversService.warnings();
  res.json({ success: true, data });
});

export default warnings;
