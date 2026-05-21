import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const endTrial = asyncHandler(async (req, res) => {
  const data = await driversService.endTrial(req.params.id, req.body.endDate);
  res.json({ success: true, data, message: "Sinov muddati belgilandi" });
});

export default endTrial;
