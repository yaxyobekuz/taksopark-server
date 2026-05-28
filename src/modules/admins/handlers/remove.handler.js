import asyncHandler from "../../../middleware/asyncHandler.js";
import * as adminsService from "../services/admins.service.js";

const remove = asyncHandler(async (req, res) => {
  await adminsService.remove(req.params.id);
  res.json({ success: true, message: "Admin o'chirildi" });
});

export default remove;
