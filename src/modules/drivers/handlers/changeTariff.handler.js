import asyncHandler from "../../../middleware/asyncHandler.js";
import * as driversService from "../services/drivers.service.js";

const changeTariff = asyncHandler(async (req, res) => {
  const data = await driversService.changeTariff(req.params.id, req.body, req.user);
  res.json({ success: true, data, message: "Tarif o'zgartirildi" });
});

export default changeTariff;
