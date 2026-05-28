import asyncHandler from "../../../middleware/asyncHandler.js";
import * as authService from "../services/auth.service.js";

const changeMyPassword = asyncHandler(async (req, res) => {
  await authService.changeMyPassword(req.user, req.body);
  res.json({ success: true, message: "Parol yangilandi" });
});

export default changeMyPassword;
