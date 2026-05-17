import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";
import { parsePagination, buildMeta } from "../../../utils/pagination.js";

const list = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { items, total } = await carsService.list({
    search: req.query.search,
    isActive: req.query.isActive,
    page,
    limit,
  });
  res.json({ success: true, data: items, meta: buildMeta({ page, limit, total }) });
});

export default list;
