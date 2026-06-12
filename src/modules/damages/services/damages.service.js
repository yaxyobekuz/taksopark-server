import Damage from "../../../models/damage.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";

export const list = async ({ driverId, carId, fromDate, toDate, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (carId) filter.car = carId;
  if (fromDate || toDate) {
    filter.incidentDate = {};
    if (fromDate) filter.incidentDate.$gte = startOfDayTashkent(fromDate);
    if (toDate) filter.incidentDate.$lte = startOfDayTashkent(toDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Damage.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model notes")
      .sort({ incidentDate: -1 })
      .skip(skip)
      .limit(limit),
    Damage.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const damage = await Damage.findById(id)
    .populate("driver", "firstName lastName phone")
    .populate("car", "plateNumber model notes");
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  return damage;
};

export const create = async (body, attachments, currentUser) => {
  if (!attachments || attachments.length === 0) {
    throw new ApiError(400, "Zarar uchun rasm yoki hujjat majburiy");
  }
  const driver = await Driver.findById(body.driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const incidentDate = startOfDayTashkent(body.incidentDate);

  return Damage.create({
    driver: driver._id,
    car: driver.car,
    amount: body.amount,
    incidentDate,
    attachments,
    createdBy: currentUser._id,
    note: body.note || "",
  });
};

export const update = async (id, body) => {
  const damage = await Damage.findById(id);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  if (body.note !== undefined) damage.note = body.note;
  if (body.amount !== undefined) damage.amount = body.amount;
  await damage.save();
  return damage;
};

export const remove = async (id) => {
  const damage = await Damage.findById(id);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  await damage.deleteOne();
};
