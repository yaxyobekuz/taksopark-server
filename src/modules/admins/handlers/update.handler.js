import asyncHandler from "../../../middleware/asyncHandler.js";
import * as adminsService from "../services/admins.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await adminsService.update(req.params.id, req.body);
  res.json({ success: true, data, message: "Admin yangilandi" });
});

export default update;
