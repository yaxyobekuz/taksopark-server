import asyncHandler from "../../../middleware/asyncHandler.js";
import * as adminsService from "../services/admins.service.js";

const changePassword = asyncHandler(async (req, res) => {
  const data = await adminsService.changePassword(req.params.id, req.body.password);
  res.json({ success: true, data, message: "Parol yangilandi" });
});

export default changePassword;
