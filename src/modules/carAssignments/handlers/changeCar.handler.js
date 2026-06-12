import asyncHandler from "../../../middleware/asyncHandler.js";
import * as service from "../services/carAssignments.service.js";

const changeCar = asyncHandler(async (req, res) => {
  const { driverId, carId, fromDate } = req.body;
  const data = await service.changeCar(driverId, { carId, fromDate }, req.user);
  res.status(201).json({ success: true, data, message: "Mashina almashtirildi" });
});

export default changeCar;
