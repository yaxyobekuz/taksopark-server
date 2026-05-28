import asyncHandler from "../../../middleware/asyncHandler.js";
import * as adminsService from "../services/admins.service.js";

const getById = asyncHandler(async (req, res) => {
  const data = await adminsService.getById(req.params.id);
  res.json({ success: true, data });
});

export default getById;
