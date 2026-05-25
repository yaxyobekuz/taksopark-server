import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const addDocument = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const data = await carsService.addDocument(req.params.id, req.body, files);
  res.status(201).json({ success: true, data, message: "Hujjat qo'shildi" });
});

export default addDocument;
