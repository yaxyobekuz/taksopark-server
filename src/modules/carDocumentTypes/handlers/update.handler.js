import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/carDocumentTypes.service.js";

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.params.id, req.body);
  res.json({ success: true, data, message: "Hujjat turi yangilandi" });
});

export default update;
