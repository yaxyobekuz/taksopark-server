import asyncHandler from "../../../middleware/asyncHandler.js";
import * as finesService from "../services/fines.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await finesService.update(req.params.id, req.body, req.user);
  res.json({ success: true, data, message: "Jarima yangilandi" });
});

export default update;
