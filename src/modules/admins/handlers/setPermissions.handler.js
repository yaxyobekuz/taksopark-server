import asyncHandler from "../../../middleware/asyncHandler.js";
import * as adminsService from "../services/admins.service.js";

const setPermissions = asyncHandler(async (req, res) => {
  const data = await adminsService.setPermissions(req.params.id, req.body.permissions);
  res.json({ success: true, data, message: "Ruxsatlar saqlandi" });
});

export default setPermissions;
