import RestDay from "../../../models/restDay.model.js";
import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import DailyPayment from "../../../models/dailyPayment.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent, addDays, addMonths, endOfDayTashkent, dateKeyTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";

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
  if (driver.status !== DRIVER_STATUS.ACTIVE) {
    throw new ApiError(409, "Haydovchi faol emas");
  }
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const date = startOfDayTashkent(body.date);

  // To'lov mavjud va 0 dan katta bo'lsa, bu kunni dam olish qilib bo'lmaydi.
  const payment = await DailyPayment.findOne({ driver: driver._id, date });
  if (payment && payment.amount > 0) {
    throw new ApiError(409, "Bu kun uchun to'lov mavjud, dam olish kuni qilib bo'lmaydi");
  }

  try {
    return await RestDay.create({
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
};

export const remove = async (id) => {
  const restDay = await RestDay.findById(id);
  if (!restDay) throw new ApiError(404, "Dam olish kuni topilmadi");
  await restDay.deleteOne();
};

// Tanlangan oyning har bir kuni uchun to'lov holati va dam olish belgisini qaytaradi.
export const monthCalendar = async ({ driverId, year, month }) => {
  const driver = await Driver.findById(driverId).populate(
    "car",
    "plateNumber model dailyPaymentDeposit dailyPaymentNoDeposit monthlyCashback",
  );
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  // Oyning birinchi va oxirgi kunini Tashkent TZ bilan hisoblaymiz.
  const monthStart = startOfDayTashkent(new Date(Date.UTC(year, month - 1, 1)));
  const nextMonthStart = startOfDayTashkent(addMonths(monthStart, 1));
  const monthEnd = endOfDayTashkent(addDays(nextMonthStart, -1));

  const [payments, restDays] = await Promise.all([
    DailyPayment.find({ driver: driver._id, date: { $gte: monthStart, $lte: monthEnd } }),
    RestDay.find({ driver: driver._id, date: { $gte: monthStart, $lte: monthEnd } }),
  ]);

  const paymentByTime = new Map(
    payments.map((p) => [startOfDayTashkent(p.date).getTime(), p]),
  );
  const restByTime = new Map(
    restDays.map((r) => [startOfDayTashkent(r.date).getTime(), r]),
  );

  const days = [];
  let cursor = monthStart;
  while (cursor < nextMonthStart) {
    const t = cursor.getTime();
    const payment = paymentByTime.get(t) || null;
    const rest = restByTime.get(t) || null;

    let dailyPlan = 0;
    if (driver.car) {
      try {
        dailyPlan = getActiveTariffPhase(driver, driver.car, cursor).dailyPlan;
      } catch {
        dailyPlan = 0;
      }
    }

    days.push({
      date: cursor,
      dateKey: dateKeyTashkent(cursor),
      isRestDay: !!rest,
      restDayId: rest?._id || null,
      payment: payment
        ? { id: payment._id, amount: payment.amount, expectedPlan: payment.expectedPlan }
        : null,
      dailyPlan,
    });
    cursor = startOfDayTashkent(addDays(cursor, 1));
  }

  return { driver, days };
};
