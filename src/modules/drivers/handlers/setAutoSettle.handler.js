import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const setAutoSettle = asyncHandler(async (req, res) => {
  const data = await driversService.setAutoSettleDaily(req.params.id, req.body.enabled);
  res.json({ success: true, data, message: "Saqlandi" });
});

export default setAutoSettle;
