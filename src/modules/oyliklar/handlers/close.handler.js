import asyncHandler from "../../../middleware/asyncHandler.js";
import * as oyliklarService from "../services/oyliklar.service.js";

const close = asyncHandler(async (req, res) => {
  const data = await oyliklarService.close(req.params.id, req.user);
  res.json({ success: true, data, message: "Oylik yopildi" });
});

export default close;
