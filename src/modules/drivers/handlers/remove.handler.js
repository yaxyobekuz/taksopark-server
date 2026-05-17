import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const remove = asyncHandler(async (req, res) => {
  await driversService.softRemove(req.params.id);
  res.json({ success: true, message: "Haydovchi arxivlandi" });
});

export default remove;
