import asyncHandler from "../../../middleware/asyncHandler.js";
import * as workPeriodsService from "../services/workPeriods.service.js";

const create = asyncHandler(async (req, res) => {
  const { driverId, ...body } = req.body;
  const data = await workPeriodsService.create(driverId, body, req.user);
  res.status(201).json({ success: true, data, message: "Ish davri qo'shildi" });
});

export default create;
