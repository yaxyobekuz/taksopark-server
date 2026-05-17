import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const unblock = asyncHandler(async (req, res) => {
  const data = await driversService.unblock(req.params.id);
  res.json({ success: true, data, message: "Haydovchi blokdan chiqarildi" });
});

export default unblock;
