import asyncHandler from "../../../middleware/asyncHandler.js";
import * as damagesService from "../services/damages.service.js";

const remove = asyncHandler(async (req, res) => {
  await damagesService.remove(req.params.id, req.user);
  res.json({ success: true, message: "Zarar o'chirildi" });
});

export default remove;
