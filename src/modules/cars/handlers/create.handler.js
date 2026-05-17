import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const create = asyncHandler(async (req, res) => {
  const data = await carsService.create(req.body);
  res.status(201).json({ success: true, data, message: "Mashina qo'shildi" });
});

export default create;
