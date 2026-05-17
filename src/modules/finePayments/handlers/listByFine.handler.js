import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/finePayments.service.js";

const listByFine = asyncHandler(async (req, res) => {
  const data = await service.listByFine(req.params.fineId);
  res.json({ success: true, data });
});

export default listByFine;
