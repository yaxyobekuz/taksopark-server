import asyncHandler from "../../../middleware/asyncHandler.js";
import * as restdaysService from "../services/restdays.service.js";

const calendar = asyncHandler(async (req, res) => {
  const data = await restdaysService.monthCalendar({
    driverId: req.query.driverId,
    year: Number(req.query.year),
    month: Number(req.query.month),
  });
  res.json({ success: true, data });
});

export default calendar;
