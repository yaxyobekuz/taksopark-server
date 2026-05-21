import asyncHandler from "../../../middleware/asyncHandler.js";
import * as oyliklarService from "../services/oyliklar.service.js";

const current = asyncHandler(async (req, res) => {
  const data = await oyliklarService.currentForDriver(req.params.driverId);
  res.json({ success: true, data });
});

export default current;
