import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const create = asyncHandler(async (req, res) => {
  const data = await driversService.create(req.body);
  res.status(201).json({ success: true, data, message: "Haydovchi qo'shildi" });
});

export default create;
