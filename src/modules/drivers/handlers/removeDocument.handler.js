import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const removeDocument = asyncHandler(async (req, res) => {
  const data = await driversService.removeDocument(req.params.id, req.params.docId);
  res.json({ success: true, data, message: "Hujjat o'chirildi" });
});

export default removeDocument;
