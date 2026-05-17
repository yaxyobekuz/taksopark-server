import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";
import { parsePagination, buildMeta } from "../../../utils/pagination.js";

const list = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { items, total } = await driversService.list({
    tariff: req.query.tariff,
    status: req.query.status,
    carId: req.query.carId,
    search: req.query.search,
    depositBelow: req.query.depositBelow,
    page,
    limit,
  });
  res.json({ success: true, data: items, meta: buildMeta({ page, limit, total }) });
});

export default list;
