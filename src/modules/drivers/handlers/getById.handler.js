import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const getById = asyncHandler(async (req, res) => {
  const data = await driversService.getById(req.params.id);
  res.json({ success: true, data });
});

export default getById;
