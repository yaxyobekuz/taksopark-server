import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carPricesService from "../services/carPrices.service.js";

const list = asyncHandler(async (req, res) => {
  const data = await carPricesService.list(req.query.carId);
  res.json({ success: true, data });
});

export default list;
