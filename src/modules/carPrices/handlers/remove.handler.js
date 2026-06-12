import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carPricesService from "../services/carPrices.service.js";

const remove = asyncHandler(async (req, res) => {
  await carPricesService.remove(req.params.id);
  res.json({ success: true, message: "Narx davri o'chirildi" });
});

export default remove;
