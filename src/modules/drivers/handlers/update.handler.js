import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await driversService.update(req.params.id, req.body);
  res.json({ success: true, data, message: "Haydovchi yangilandi" });
});

export default update;
