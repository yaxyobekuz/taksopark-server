import asyncHandler from "../../../middleware/asyncHandler.js";
import * as usersService from "../services/users.service.js";

const getById = asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.params.id);
  res.json({ success: true, data: user });
});

export default getById;
