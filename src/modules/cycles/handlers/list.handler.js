import asyncHandler from "../../../middleware/asyncHandler.js";
import * as cyclesService from "../services/cycles.service.js";
import { parsePagination, buildMeta } from "../../../utils/pagination.js";

const list = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { items, total } = await cyclesService.list({
    driverId: req.query.driverId,
    status: req.query.status,
    page,
    limit,
  });
  res.json({ success: true, data: items, meta: buildMeta({ page, limit, total }) });
});

export default list;
