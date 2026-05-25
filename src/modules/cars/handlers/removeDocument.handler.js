import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const removeDocument = asyncHandler(async (req, res) => {
  const data = await carsService.removeDocument(req.params.id, req.params.docId);
  res.json({ success: true, data, message: "Hujjat o'chirildi" });
});

export default removeDocument;
