import RestDay from "../../../models/restDay.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent, addDays, addMonths, endOfDayTashkent, dateKeyTashkent } from "../../../utils/timezone.js";
import { hasTransactionsOnDate, syncDay } from "../../payments/services/dailyPlans.service.js";

export const isRestDay = async (driverId, date) => {
  const day = startOfDayTashkent(date);
  const exists = await RestDay.exists({ driver: driverId, date: day });
  return !!exists;
};

export const list = async ({ driverId, fromDate, toDate, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = startOfDayTashkent(fromDate);
    if (toDate) filter.date.$lte = startOfDayTashkent(toDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    RestDay.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    RestDay.countDocuments(filter),
  ]);
  return { items, total };
};

export const create = async (body, currentUser) => {
  const driver = await Driver.findById(body.driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const date = startOfDayTashkent(body.date);

  // Kunlik to'lov qilingan kunni dam olish deb belgilab bo'lmaydi.
  if (await hasTransactionsOnDate(driver._id, date)) {
    throw new ApiError(409, "Bu kun uchun to'lov mavjud - dam olish kuni deb belgilab bo'lmaydi");
  }

  let restDay;
  try {
    restDay = await RestDay.create({
      driver: driver._id,
      car: driver.car,
      date,
      note: body.note || "",
      createdBy: currentUser._id,
    });
  } catch (e) {
    if (e?.code === 11000) {
      throw new ApiError(409, "Bu kun allaqachon dam olish kuni");
    }
    throw e;
  }

  // Kunlik plan dam olish kuniga sinxronlanadi (majburiyat 0 bo'ladi).
  await syncDay(driver._id, date);
  return restDay;
};

export const remove = async (id) => {
  const restDay = await RestDay.findById(id);
  if (!restDay) throw new ApiError(404, "Dam olish kuni topilmadi");
  const { driver, date } = restDay;
  await restDay.deleteOne();
  // Plan ish kuniga qaytadi (majburiyat o'sha kungi narxdan tiklanadi).
  await syncDay(driver, date);
};

// Tanlangan oyning har bir kuni uchun dam olish belgisini qaytaradi.
export const monthCalendar = async ({ driverId, year, month }) => {
  const driver = await Driver.findById(driverId).populate("car", "plateNumber model");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  // Oyning birinchi va oxirgi kunini Tashkent TZ bilan hisoblaymiz.
  const monthStart = startOfDayTashkent(new Date(Date.UTC(year, month - 1, 1)));
  const nextMonthStart = startOfDayTashkent(addMonths(monthStart, 1));
  const monthEnd = endOfDayTashkent(addDays(nextMonthStart, -1));

  const restDays = await RestDay.find({
    driver: driver._id,
    date: { $gte: monthStart, $lte: monthEnd },
  });

  const restByTime = new Map(
    restDays.map((r) => [startOfDayTashkent(r.date).getTime(), r]),
  );

  const days = [];
  let cursor = monthStart;
  while (cursor < nextMonthStart) {
    const rest = restByTime.get(cursor.getTime()) || null;
    days.push({
      date: cursor,
      dateKey: dateKeyTashkent(cursor),
      isRestDay: !!rest,
      restDayId: rest?._id || null,
    });
    cursor = startOfDayTashkent(addDays(cursor, 1));
  }

  return { driver, days };
};
