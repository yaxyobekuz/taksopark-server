import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await carsService.update(req.params.id, req.body);
  res.json({ success: true, data, message: "Mashina yangilandi" });
});

export default update;
