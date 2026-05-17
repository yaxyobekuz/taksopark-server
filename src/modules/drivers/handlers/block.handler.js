import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const block = asyncHandler(async (req, res) => {
  const data = await driversService.block(req.params.id, req.body.reason, req.user);
  res.json({ success: true, data, message: "Haydovchi bloklandi" });
});

export default block;
