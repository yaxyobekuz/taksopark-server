import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/carAssignments.service.js";

const create = asyncHandler(async (req, res) => {
  const { driverId, ...body } = req.body;
  const data = await service.create(driverId, body, req.user);
  res.status(201).json({ success: true, data, message: "Mashina biriktirildi" });
});

export default create;
