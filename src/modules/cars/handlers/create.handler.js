import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";
import { fileToPublicUrl } from "../../../utils/fileStorage.js";

const create = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (req.file) body.photoUrl = fileToPublicUrl(req.file);
  const data = await carsService.create(body);
  res.status(201).json({ success: true, data, message: "Mashina qo'shildi" });
});

export default create;
