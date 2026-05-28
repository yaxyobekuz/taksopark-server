import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const adjustDeposit = asyncHandler(async (req, res) => {
  const data = await driversService.adjustDeposit(req.params.id, req.body, req.user);
  res.json({ success: true, data, message: "Depozit yangilandi" });
});

export default adjustDeposit;
