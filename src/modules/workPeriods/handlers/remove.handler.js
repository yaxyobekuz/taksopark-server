import asyncHandler from "../../../middleware/asyncHandler.js";
import * as workPeriodsService from "../services/workPeriods.service.js";

const remove = asyncHandler(async (req, res) => {
  await workPeriodsService.remove(req.params.id);
  res.json({ success: true, message: "Ish davri o'chirildi" });
});

export default remove;
