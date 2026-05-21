import asyncHandler from "../../../middleware/asyncHandler.js";
import * as oyliklarService from "../services/oyliklar.service.js";

const getById = asyncHandler(async (req, res) => {
  const data = await oyliklarService.getById(req.params.id);
  res.json({ success: true, data });
});

export default getById;
