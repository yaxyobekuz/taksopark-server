import Fine from "../../../models/fine.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { settleDriver, reverseCoverageFor } from "../../finance/services/settlement.service.js";
import { carForDriverOnDate } from "../../payments/services/dailyPlans.service.js";

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

  const issueDate = startOfDayTashkent(body.issueDate);
  // §2: mashina o'sha kungi biriktirishdan olinadi (joriy driver.car emas) - eski
  // jarima ham o'sha kungi haqiqiy mashinaga bog'lanadi.
  const carId = await carForDriverOnDate(driver._id, issueDate);
  if (!carId) throw new ApiError(409, "Bu sanada haydovchiga mashina biriktirilmagan");

  const fine = await Fine.create({
    driver: driver._id,
    car: carId,
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

export const update = async (id, body, currentUser) => {
  const fine = await Fine.findById(id);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  if (body.note !== undefined) fine.note = body.note;

  const amountChanged = body.amount !== undefined && Number(body.amount) !== fine.amount;
  if (body.amount !== undefined) fine.amount = Number(body.amount);
  await fine.save();

  // Summa o'zgarsa: eski coverage'ni to'liq teskari qaytaramiz, so'ng settlement
  // yangi (kichraygan/oshgan) miqdorni qaytadan qoplaydi (§9, §10).
  if (amountChanged) {
    await reverseCoverageFor(fine.driver, "fine", fine._id, currentUser._id);
    await settleDriver(fine.driver, currentUser._id);
  }
  return fine;
};

export const remove = async (id, currentUser) => {
  const fine = await Fine.findById(id);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  const driverId = fine.driver;
  // Jarima o'chsa, undan qoplangan pul (depozit/keshbek) manbaga qaytarilishi shart (§9).
  await reverseCoverageFor(driverId, "fine", fine._id, currentUser._id);
  await fine.deleteOne();
  await settleDriver(driverId, currentUser._id);
};
