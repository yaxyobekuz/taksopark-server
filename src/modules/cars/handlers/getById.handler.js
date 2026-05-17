import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const getById = asyncHandler(async (req, res) => {
  const data = await carsService.getById(req.params.id);
  res.json({ success: true, data });
});

export default getById;
