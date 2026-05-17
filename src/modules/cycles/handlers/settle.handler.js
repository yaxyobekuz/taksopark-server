import asyncHandler from "../../../middleware/asyncHandler.js";
import * as cyclesService from "../services/cycles.service.js";

const settle = asyncHandler(async (req, res) => {
  const data = await cyclesService.settle(req.params.id, req.user);
  res.json({ success: true, data, message: "Tsikl yakunlandi" });
});

export default settle;
