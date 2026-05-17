import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const remove = asyncHandler(async (req, res) => {
  await carsService.softRemove(req.params.id);
  res.json({ success: true, message: "Mashina o'chirildi" });
});

export default remove;
