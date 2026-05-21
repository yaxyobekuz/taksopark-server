import asyncHandler from "../../../middleware/asyncHandler.js";
import * as oyliklarService from "../services/oyliklar.service.js";

const updatePayout = asyncHandler(async (req, res) => {
  const data = await oyliklarService.updatePayout(req.params.id, req.params.payoutId, req.body);
  res.json({ success: true, data, message: "To'lov yangilandi" });
});

export default updatePayout;
