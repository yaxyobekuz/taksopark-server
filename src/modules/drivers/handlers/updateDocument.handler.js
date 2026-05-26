import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const updateDocument = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const data = await driversService.updateDocument(
    req.params.id,
    req.params.docId,
    req.body,
    files,
  );
  res.json({ success: true, data, message: "Hujjat yangilandi" });
});

export default updateDocument;
