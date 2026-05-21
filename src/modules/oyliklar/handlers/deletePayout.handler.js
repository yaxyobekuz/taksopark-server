import asyncHandler from "../../../middleware/asyncHandler.js";
import * as oyliklarService from "../services/oyliklar.service.js";

const deletePayout = asyncHandler(async (req, res) => {
  const data = await oyliklarService.removePayout(req.params.id, req.params.payoutId);
  res.json({ success: true, data, message: "To'lov o'chirildi" });
});

export default deletePayout;
