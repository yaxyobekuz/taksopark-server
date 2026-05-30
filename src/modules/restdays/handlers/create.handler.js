import asyncHandler from "../../../middleware/asyncHandler.js";
import * as restdaysService from "../services/restdays.service.js";

const create = asyncHandler(async (req, res) => {
  const data = await restdaysService.create(req.body, req.user);
  res.status(201).json({ success: true, data, message: "Dam olish kuni belgilandi" });
});

export default create;
