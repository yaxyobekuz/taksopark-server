import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";
import { fileToPublicUrl } from "../../../utils/fileStorage.js";

const update = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (req.file) body.photoUrl = fileToPublicUrl(req.file);
  const data = await carsService.update(req.params.id, body);
  res.json({ success: true, data, message: "Mashina yangilandi" });
});

export default update;
