import asyncHandler from "../../../middleware/asyncHandler.js";
import * as oyliklarService from "../services/oyliklar.service.js";

const statement = asyncHandler(async (req, res) => {
  const data = await oyliklarService.statementForDriver(req.params.driverId);
  res.json({ success: true, data });
});

export default statement;
