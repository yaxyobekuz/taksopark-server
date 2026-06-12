import asyncHandler from "../../../middleware/asyncHandler.js";
import * as workPeriodsService from "../services/workPeriods.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await workPeriodsService.update(req.params.id, req.body);
  res.json({ success: true, data, message: "Ish davri yangilandi" });
});

export default update;
