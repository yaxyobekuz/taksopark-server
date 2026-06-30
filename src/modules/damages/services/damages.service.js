import Damage from "../../../models/damage.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { settleDriver, clearCoverageFor } from "../../finance/services/settlement.service.js";
import { carForDriverOnDate } from "../../payments/services/dailyPlans.service.js";

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

  const incidentDate = startOfDayTashkent(body.incidentDate);
  // §2: mashina o'sha kungi biriktirishdan olinadi (joriy driver.car emas) - eski
  // zarar ham o'sha kungi haqiqiy mashinaga bog'lanadi.
  const carId = await carForDriverOnDate(driver._id, incidentDate);
  if (!carId) throw new ApiError(409, "Bu sanada haydovchiga mashina biriktirilmagan");

  const damage = await Damage.create({
    driver: driver._id,
    car: carId,
    amount: body.amount,
    incidentDate,
    attachments,
    createdBy: currentUser._id,
    note: body.note || "",
  });
  // Zarar depozit/keshbekdan qoplanishi mumkin (§10) - settlement.
  await settleDriver(driver._id, currentUser._id);
  return damage;
};

export const update = async (id, body, currentUser) => {
  const damage = await Damage.findById(id);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  if (body.note !== undefined) damage.note = body.note;

  const amountChanged = body.amount !== undefined && Number(body.amount) !== damage.amount;
  if (body.amount !== undefined) damage.amount = Number(body.amount);
  await damage.save();

  // Summa o'zgarsa: eski coverage o(chiriladi, so(ng settlement
  // yangi miqdorni qaytadan qoplaydi (§9, §10).
  if (amountChanged) {
    await clearCoverageFor(damage.driver, "damage", damage._id);
    await settleDriver(damage.driver, currentUser._id);
  }
  return damage;
};

export const remove = async (id, currentUser) => {
  const damage = await Damage.findById(id);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  const driverId = damage.driver;
  // Zarar o'chsa, undan qoplangan pul (depozit/keshbek) manbaga qaytarilishi shart (§9).
  await clearCoverageFor(driverId, "damage", damage._id);
  await damage.deleteOne();
  await settleDriver(driverId, currentUser._id);
};
