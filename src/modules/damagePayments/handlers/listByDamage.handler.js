import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/damagePayments.service.js";

const listByDamage = asyncHandler(async (req, res) => {
  const data = await service.listByDamage(req.params.damageId);
  res.json({ success: true, data });
});

export default listByDamage;
