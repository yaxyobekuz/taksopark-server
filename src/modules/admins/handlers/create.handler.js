import asyncHandler from "../../../middleware/asyncHandler.js";
import * as adminsService from "../services/admins.service.js";

const create = asyncHandler(async (req, res) => {
  const data = await adminsService.create(req.body);
  res.status(201).json({ success: true, data, message: "Admin qo'shildi" });
});

export default create;
