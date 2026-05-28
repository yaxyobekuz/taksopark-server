import asyncHandler from "../../../middleware/asyncHandler.js";
import * as adminsService from "../services/admins.service.js";

const permissionCatalog = asyncHandler(async (_req, res) => {
  const data = adminsService.permissionCatalog();
  res.json({ success: true, data });
});

export default permissionCatalog;
