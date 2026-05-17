import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const recompute = asyncHandler(async (req, res) => {
  const data = await driversService.recompute(req.params.id);
  res.json({ success: true, data, message: "Balans qayta hisoblandi" });
});

export default recompute;
