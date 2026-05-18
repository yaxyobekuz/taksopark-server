import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const listExpiring = asyncHandler(async (req, res) => {
  const data = await carsService.listExpiring({
    limit: req.query.limit ? Number(req.query.limit) : 5,
    days: req.query.days ? Number(req.query.days) : 30,
  });
  res.json({ success: true, data });
});

export default listExpiring;
