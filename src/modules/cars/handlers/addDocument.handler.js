import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const addDocument = asyncHandler(async (req, res) => {
  const file = req.files?.[0] || null;
  const data = await carsService.addDocument(req.params.id, req.body, file);
  res.status(201).json({ success: true, data, message: "Hujjat qo'shildi" });
});

export default addDocument;
