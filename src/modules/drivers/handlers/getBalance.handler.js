import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const getBalance = asyncHandler(async (req, res) => {
  const data = await driversService.getBalance(req.params.id);
  res.json({ success: true, data });
});

export default getBalance;
