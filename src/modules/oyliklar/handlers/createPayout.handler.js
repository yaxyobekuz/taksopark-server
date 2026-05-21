import asyncHandler from "../../../middleware/asyncHandler.js";
import * as oyliklarService from "../services/oyliklar.service.js";

const createPayout = asyncHandler(async (req, res) => {
  const data = await oyliklarService.addPayout(req.params.id, req.body, req.user);
  res.status(201).json({ success: true, data, message: "To'lov saqlandi" });
});

export default createPayout;
