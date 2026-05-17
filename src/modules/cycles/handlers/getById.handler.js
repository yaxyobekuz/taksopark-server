import asyncHandler from "../../../middleware/asyncHandler.js";
import * as cyclesService from "../services/cycles.service.js";

const getById = asyncHandler(async (req, res) => {
  const data = await cyclesService.getById(req.params.id);
  res.json({ success: true, data });
});

export default getById;
