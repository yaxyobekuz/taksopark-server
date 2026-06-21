import asyncHandler from "../../../middleware/asyncHandler.js";
import * as finesService from "../services/fines.service.js";

const remove = asyncHandler(async (req, res) => {
  await finesService.remove(req.params.id, req.user);
  res.json({ success: true, message: "Jarima o'chirildi" });
});

export default remove;
