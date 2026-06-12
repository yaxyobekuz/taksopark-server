import Fine from "../../../models/fine.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { settleDriver } from "../../finance/services/settlement.service.js";

export const list = async ({ driverId, carId, fromDate, toDate, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (carId) filter.car = carId;
  if (fromDate || toDate) {
    filter.issueDate = {};
    if (fromDate) filter.issueDate.$gte = startOfDayTashkent(fromDate);
    if (toDate) filter.issueDate.$lte = startOfDayTashkent(toDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Fine.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model notes")
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limit),
    Fine.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const fine = await Fine.findById(id)
    .populate("driver", "firstName lastName phone")
    .populate("car", "plateNumber model notes");
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  return fine;
};

export const create = async (body, attachments, currentUser) => {
  if (!attachments || attachments.length === 0) {
    throw new ApiError(400, "Jarima uchun rasm yoki hujjat majburiy");
  }
  const driver = await Driver.findById(body.driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const issueDate = startOfDayTashkent(body.issueDate);

  const fine = await Fine.create({
    driver: driver._id,
    car: driver.car,
    amount: body.amount,
    issueDate,
    attachments,
    createdBy: currentUser._id,
    note: body.note || "",
  });
  // Jarima depozit/keshbekdan qoplanishi mumkin (§10) - settlement.
  await settleDriver(driver._id, currentUser._id);
  return fine;
};

export const update = async (id, body) => {
  const fine = await Fine.findById(id);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  if (body.note !== undefined) fine.note = body.note;
  if (body.amount !== undefined) fine.amount = body.amount;
  await fine.save();
  return fine;
};

export const remove = async (id) => {
  const fine = await Fine.findById(id);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  await fine.deleteOne();
};
