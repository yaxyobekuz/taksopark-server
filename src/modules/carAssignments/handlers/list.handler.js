import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/carAssignments.service.js";

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query.driverId);
  res.json({ success: true, data });
});

export default list;
