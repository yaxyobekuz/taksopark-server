import asyncHandler from "../../../middleware/asyncHandler.js";
import * as paymentsService from "../services/payments.service.js";

const remove = asyncHandler(async (req, res) => {
  await paymentsService.remove(req.params.id);
  res.json({ success: true, message: "To'lov o'chirildi" });
});

export default remove;
