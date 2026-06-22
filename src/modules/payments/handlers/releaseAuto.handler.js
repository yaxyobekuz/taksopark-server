import asyncHandler from "../../../middleware/asyncHandler.js";
import * as transactionsService from "../services/transactions.service.js";

const releaseAuto = asyncHandler(async (req, res) => {
  const data = await transactionsService.releaseAutoCoverage(req.params.id);
  res.json({ success: true, data, message: "Avtomatik qoplash bekor qilindi" });
});

export default releaseAuto;
