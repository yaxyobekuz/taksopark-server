import asyncHandler from "../../../middleware/asyncHandler.js";
import * as finesService from "../services/fines.service.js";
import { fileToAttachment } from "../../../middleware/upload.middleware.js";

const create = asyncHandler(async (req, res) => {
  const attachments = (req.files || []).map((f) => fileToAttachment("fines", f));
  const data = await finesService.create(req.body, attachments, req.user);
  res.status(201).json({ success: true, data, message: "Jarima saqlandi" });
});

export default create;
