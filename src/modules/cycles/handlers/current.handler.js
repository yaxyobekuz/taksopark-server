import asyncHandler from "../../../middleware/asyncHandler.js";
import * as cyclesService from "../services/cycles.service.js";

const current = asyncHandler(async (req, res) => {
  const data = await cyclesService.currentForDriver(req.params.driverId);
  res.json({ success: true, data });
});

export default current;
