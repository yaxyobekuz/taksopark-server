import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/transactionCategories.service.js";

const list = asyncHandler(async (req, res) => {
  const data = await service.list({ type: req.query.type });
  res.json({ success: true, data });
});

export default list;
