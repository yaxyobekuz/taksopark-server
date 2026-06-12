import asyncHandler from "../../../middleware/asyncHandler.js";
import { parsePagination, buildMeta } from "../../../utils/pagination.js";
import * as transactionsService from "../services/transactions.service.js";

const listTransactions = asyncHandler(async (req, res) => {
  const { dailyPlanId, driverId, fromDate, toDate } = req.query;
  if (dailyPlanId) {
    const data = await transactionsService.listByPlan(dailyPlanId);
    return res.json({ success: true, data });
  }
  const { page, limit } = parsePagination(req.query);
  const { items, total } = await transactionsService.listByDriver({
    driverId,
    fromDate,
    toDate,
    page,
    limit,
  });
  return res.json({ success: true, data: items, meta: buildMeta({ page, limit, total }) });
});

export default listTransactions;
