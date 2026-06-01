import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/financeReport.service.js";

const recent = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 5;
  const data = await service.recentForWallet(req.params.wallet, limit);
  res.json({ success: true, data });
});

export default recent;
