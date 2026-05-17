import asyncHandler from "../../../middleware/asyncHandler.js";
import * as paymentsService from "../services/payments.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await paymentsService.update(req.params.id, req.body);
  res.json({ success: true, data, message: "To'lov yangilandi" });
});

export default update;
