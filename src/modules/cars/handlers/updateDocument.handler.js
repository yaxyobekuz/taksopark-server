import asyncHandler from "../../../middleware/asyncHandler.js";
import * as carsService from "../services/cars.service.js";

const updateDocument = asyncHandler(async (req, res) => {
  const file = req.files?.[0] || null;
  const data = await carsService.updateDocument(
    req.params.id,
    req.params.docId,
    req.body,
    file,
  );
  res.json({ success: true, data, message: "Hujjat yangilandi" });
});

export default updateDocument;
