import asyncHandler from "../../../middleware/asyncHandler.js";
import * as restdaysService from "../services/restdays.service.js";

const remove = asyncHandler(async (req, res) => {
  await restdaysService.remove(req.params.id);
  res.json({ success: true, message: "Ish kuniga qaytarildi" });
});

export default remove;
