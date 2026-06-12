import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carPricesService from "../services/carPrices.service.js";

const create = asyncHandler(async (req, res) => {
  const { carId, ...body } = req.body;
  const data = await carPricesService.create(carId, body, req.user);
  res.status(201).json({ success: true, data, message: "Narx davri qo'shildi" });
});

export default create;
