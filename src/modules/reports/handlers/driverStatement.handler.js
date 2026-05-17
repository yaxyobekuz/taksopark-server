import asyncHandler from "../../../middleware/asyncHandler.js";
import * as reportsService from "../services/reports.service.js";

const driverStatement = asyncHandler(async (req, res) => {
  const data = await reportsService.driverStatement(req.params.driverId, {
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
  });
  res.json({ success: true, data });
});

export default driverStatement;
