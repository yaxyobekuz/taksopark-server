import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const finance = asyncHandler(async (req, res) => {
  const data = await reportsService.finance({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    carId: req.query.carId,
  });
  res.json({ success: true, data });
});

export default finance;
