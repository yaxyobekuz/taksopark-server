import asyncHandler from "../../../middleware/asyncHandler.js";
import * as finesService from "../services/fines.service.js";

const getById = asyncHandler(async (req, res) => {
  const data = await finesService.getById(req.params.id);
  res.json({ success: true, data });
});

export default getById;
