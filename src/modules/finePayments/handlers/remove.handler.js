import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/finePayments.service.js";

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  res.json({ success: true, message: "To'lov bekor qilindi" });
});

export default remove;
