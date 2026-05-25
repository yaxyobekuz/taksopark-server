import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";
import { fileToPublicUrl } from "../../../utils/fileStorage.js";

const normalize = (body) => {
  const patch = { ...body };
  if (patch.carId === "null" || patch.carId === "") patch.carId = null;
  return patch;
};

const update = asyncHandler(async (req, res) => {
  const body = normalize(req.body);
  if (req.file) body.photoUrl = fileToPublicUrl(req.file);
  const data = await driversService.update(req.params.id, body);
  res.json({ success: true, data, message: "Haydovchi yangilandi" });
});

export default update;
