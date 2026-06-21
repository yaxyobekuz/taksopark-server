import asyncHandler from "../../../middleware/asyncHandler.js";
import * as damagesService from "../services/damages.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await damagesService.update(req.params.id, req.body, req.user);
  res.json({ success: true, data, message: "Zarar yangilandi" });
});

export default update;
