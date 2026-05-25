import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/carDocumentTypes.service.js";

const remove = asyncHandler(async (req, res) => {
  const data = await service.remove(req.params.id);
  res.json({ success: true, data, message: "Hujjat turi o'chirildi" });
});

export default remove;
