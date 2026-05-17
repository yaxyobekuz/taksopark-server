import asyncHandler from "../../../middleware/asyncHandler.js";
import * as damagesService from "../services/damages.service.js";
import { fileToAttachment } from "../../../middleware/upload.middleware.js";

const create = asyncHandler(async (req, res) => {
  const attachments = (req.files || []).map((f) => fileToAttachment("damages", f));
  const data = await damagesService.create(req.body, attachments, req.user);
  res.status(201).json({ success: true, data, message: "Zarar saqlandi" });
});

export default create;
