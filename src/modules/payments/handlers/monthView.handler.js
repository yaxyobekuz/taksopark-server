import asyncHandler from "../../../middleware/asyncHandler.js";
import * as dailyPlansService from "../services/dailyPlans.service.js";
import { settleDriver } from "../../finance/services/settlement.service.js";

const monthView = asyncHandler(async (req, res) => {
  const { driverId, year, month } = req.query;
  // Ko'rishdan oldin mavjud depozit/keshbek bilan qarzlarni qoplaymiz — kunlar
  // "depozitdan/keshbekdan to'langan" ko'rinishida chiqsin (§10).
  await settleDriver(driverId);
  const data = await dailyPlansService.monthView({ driverId, year, month });
  res.json({ success: true, data });
});

export default monthView;
