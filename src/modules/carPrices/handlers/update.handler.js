import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carPricesService from "../services/carPrices.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await carPricesService.update(req.params.id, req.body);
  res.json({ success: true, data, message: "Narx davri yangilandi" });
});

export default update;
