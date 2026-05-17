import asyncHandler from "../../../middleware/asyncHandler.js";
import * as damagesService from "../services/damages.service.js";

const getById = asyncHandler(async (req, res) => {
  const data = await damagesService.getById(req.params.id);
  res.json({ success: true, data });
});

export default getById;
