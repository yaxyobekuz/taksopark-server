import DailyPlan from "../../../models/dailyPlan.model.js";
import Transaction, { TX_TYPE } from "../../../models/transaction.model.js";
import WorkPeriod from "../../../models/workPeriod.model.js";
import CarPrice from "../../../models/carPrice.model.js";
import CarAssignment from "../../../models/carAssignment.model.js";
import Car from "../../../models/car.model.js";
import RestDay from "../../../models/restDay.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import {
  startOfDayTashkent,
  addDays,
  addMonths,
  dateKeyTashkent,
} from "../../../utils/timezone.js";

const INF = Number.POSITIVE_INFINITY;
const dayMs = (d) => startOfDayTashkent(d).getTime();
const startMs = (p) => dayMs(p.startDate);
const endMs = (p) => (p.endDate == null ? INF : dayMs(p.endDate));
// Davr/narx oralig'i shu kunni qamraydimi (inclusive, null end = cheksiz)?
const coversDay = (period, t) => startMs(period) <= t && t <= endMs(period);

// O'sha kungi tarif bo'yicha kunlik narx.
const rateForTariff = (carPrice, tariff) => {
  if (!carPrice) return 0;
  return tariff === "deposit" ? carPrice.dailyRateDeposit : carPrice.dailyRateCashback;
};

// In-memory massivlardan o'sha kun uchun snapshotni yig'adi (DB'ga yozmaydi).
// Mashina o'sha kungi TAYINLASH davridan olinadi (§2), driver.car (joriy) dan EMAS -
// shu sababli o'tmishdagi kunlar o'sha kungi haqiqiy mashinada qoladi.
const buildSnapshot = ({ driver, dayDate, periods, assignments, prices, carById, restByKey }) => {
  const t = dayDate.getTime();
  const period = periods.find((p) => coversDay(p, t));
  if (!period) return null; // bu kun hech qaysi ish davriga tushmaydi

  const tariff = period.tariff;
  const assignment = assignments.find((a) => coversDay(a, t)) || null;
  const carId = assignment ? assignment.car : null;
  const carDoc = carId ? carById.get(String(carId)) || null : null;
  const carPrice = carId
    ? prices.find((pr) => String(pr.car) === String(carId) && coversDay(pr, t)) || null
    : null;
  const dateKey = dateKeyTashkent(dayDate);
  const restDay = restByKey.get(dateKey) || null;
  const isRestDay = !!restDay;
  const priceMissing = !carId || !carPrice;
  const dailyRate = rateForTariff(carPrice, tariff);
  const planAmount = isRestDay || priceMissing ? 0 : dailyRate;

  return {
    driver: driver._id,
    date: dayDate,
    dateKey,
    workPeriod: period._id,
    tariff,
    car: carId || null,
    carSnapshot: { plateNumber: carDoc?.plateNumber || "", model: carDoc?.model || "" },
    carPrice: carPrice?._id || null,
    dailyRate,
    monthlyCashback: carPrice?.monthlyCashback || 0,
    priceMissing,
    isRestDay,
    restDay: restDay?._id || null,
    planAmount,
  };
};

// Plandagi "to'langan summa" = payment − reversal yig'indisi (§9).
export const paidByPlan = async (planIds) => {
  const map = new Map();
  if (!planIds.length) return map;
  const rows = await Transaction.aggregate([
    { $match: { dailyPlan: { $in: planIds } } },
    {
      $group: {
        _id: "$dailyPlan",
        payment: {
          $sum: { $cond: [{ $eq: ["$type", TX_TYPE.PAYMENT] }, "$amount", 0] },
        },
        reversal: {
          $sum: { $cond: [{ $eq: ["$type", TX_TYPE.REVERSAL] }, "$amount", 0] },
        },
      },
    },
  ]);
  for (const r of rows) map.set(String(r._id), r.payment - r.reversal);
  return map;
};

// Kunlik plandan DERIVED qiymatlar (to'langan, qarz).
const decoratePlan = (plan, paid) => {
  const obj = typeof plan.toJSON === "function" ? plan.toJSON() : plan;
  obj.paidAmount = paid || 0;
  obj.debt = Math.max(0, (obj.planAmount || 0) - obj.paidAmount); // §10: qarz hech qachon manfiy emas
  obj.overpaid = Math.max(0, obj.paidAmount - (obj.planAmount || 0));
  return obj;
};

// Tranzaksiyali plan MUZLAGAN (§1) - snapshotini jimgina qayta yozmaymiz.
const frozenPlanIds = async (driverId, fromDate, toDate) => {
  const ids = await Transaction.distinct("dailyPlan", {
    driver: driverId,
    date: { $gte: fromDate, $lte: toDate },
  });
  return new Set(ids.map(String));
};

// Berilgan oraliqdagi (faqat bugun va o'tmish) kunlik planlarni IDEMPOTENT yaratadi/
// yangilaydi. Muzlagan (tranzaksiyali) planlar tegilmaydi (§11 muzlatish chegarasi).
const ensureRange = async ({ driver, fromDate, toDate }) => {
  const today = startOfDayTashkent(new Date());
  const end = toDate.getTime() > today.getTime() ? today : toDate;
  if (fromDate.getTime() > end.getTime()) return;

  const [periods, assignments, restDays, frozen] = await Promise.all([
    WorkPeriod.find({ driver: driver._id }),
    CarAssignment.find({ driver: driver._id }),
    RestDay.find({ driver: driver._id, date: { $gte: fromDate, $lte: end } }),
    frozenPlanIds(driver._id, fromDate, end),
  ]);
  // Tayinlangan barcha mashinalarning narxlari va ma'lumotlari (kun bo'yicha snapshot uchun).
  const carIds = [...new Set(assignments.map((a) => String(a.car)))];
  const [prices, cars] = await Promise.all([
    carIds.length ? CarPrice.find({ car: { $in: carIds } }) : Promise.resolve([]),
    carIds.length ? Car.find({ _id: { $in: carIds } }).select("plateNumber model") : Promise.resolve([]),
  ]);
  const carById = new Map(cars.map((c) => [String(c._id), c]));
  const restByKey = new Map(restDays.map((r) => [dateKeyTashkent(r.date), r]));

  const existing = await DailyPlan.find({
    driver: driver._id,
    date: { $gte: fromDate, $lte: end },
  });
  const existingByKey = new Map(existing.map((p) => [p.dateKey, p]));

  const ops = [];
  const coveredKeys = new Set();
  let cursor = fromDate;
  while (cursor.getTime() <= end.getTime()) {
    const snap = buildSnapshot({ driver, dayDate: cursor, periods, assignments, prices, carById, restByKey });
    const dateKey = dateKeyTashkent(cursor);
    if (snap) {
      coveredKeys.add(dateKey);
      const current = existingByKey.get(dateKey);
      if (!current) {
        ops.push({ insertOne: { document: snap } });
      } else if (!frozen.has(String(current._id))) {
        // Muzlamagan plan: forward-propagatsiya (§11B) - snapshotni yangilab qo'yamiz.
        ops.push({
          updateOne: { filter: { _id: current._id }, update: { $set: snap } },
        });
      }
    }
    cursor = startOfDayTashkent(addDays(cursor, 1));
  }

  // Endi hech qaysi ish davriga tushmaydigan (qamralmagan) muzlamagan planlarni
  // o'chiramiz - ish davri qisqartirilsa/o'chirilsa soxta reja/qarz qolmasligi uchun.
  // Muzlagan (tranzaksiyali) plan kuni referensial qulf tufayli davrdan chiqarilolmaydi.
  for (const p of existing) {
    if (!coveredKeys.has(p.dateKey) && !frozen.has(String(p._id))) {
      ops.push({ deleteOne: { filter: { _id: p._id } } });
    }
  }

  if (ops.length) {
    try {
      await DailyPlan.bulkWrite(ops, { ordered: false });
    } catch (e) {
      // Bir vaqtning o'zida yaratishda unique (driver+dateKey) to'qnashuvi bo'lishi
      // mumkin - bu xavfsiz, e'tiborsiz qoldiramiz. Boshqa xatolar qayta tashlanadi.
      const isDup =
        e?.code === 11000 ||
        (Array.isArray(e?.writeErrors) && e.writeErrors.every((w) => w?.code === 11000));
      if (!isDup) throw e;
    }
  }
};

// Oylik ko'rinish: oy uchun planlarni ta'minlaydi va to'langan/qarz bilan qaytaradi.
export const monthView = async ({ driverId, year, month }) => {
  const driver = await Driver.findById(driverId).populate("car", "plateNumber model");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  const monthStart = startOfDayTashkent(new Date(Date.UTC(year, month - 1, 1)));
  const nextMonthStart = startOfDayTashkent(addMonths(monthStart, 1));
  const monthEnd = startOfDayTashkent(addDays(nextMonthStart, -1));

  await ensureRange({ driver, fromDate: monthStart, toDate: monthEnd });

  const plans = await DailyPlan.find({
    driver: driverId,
    date: { $gte: monthStart, $lte: monthEnd },
  }).sort({ date: 1 });

  const paid = await paidByPlan(plans.map((p) => p._id));
  const decorated = plans.map((p) => decoratePlan(p, paid.get(String(p._id))));

  const summary = decorated.reduce(
    (acc, p) => {
      acc.planTotal += p.planAmount;
      acc.paidTotal += p.paidAmount;
      acc.debtTotal += p.debt;
      return acc;
    },
    { planTotal: 0, paidTotal: 0, debtTotal: 0 },
  );

  return { driver, plans: decorated, summary };
};

// Bitta plan + uning DERIVED qiymatlari.
export const getPlanById = async (id) => {
  const plan = await DailyPlan.findById(id)
    .populate("driver", "firstName lastName phone")
    .populate("car", "plateNumber model");
  if (!plan) throw new ApiError(404, "Kunlik plan topilmadi");
  const paid = await paidByPlan([plan._id]);
  return decoratePlan(plan, paid.get(String(plan._id)));
};

// --- Referensial qulf (§5) yordamchilari ---
// Berilgan filtrga mos kunlik planlarga BOG'LANGAN tranzaksiyalar qamragan sana
// oralig'i (min..max) yoki null. Ish davri / narx davrini tahrirlash-o'chirish
// cheklash uchun ishlatiladi (manba - modellar, servis emas; tsikl yo'q).
const transactedRange = async (planFilter) => {
  const planIds = await DailyPlan.distinct("_id", planFilter);
  if (!planIds.length) return null;
  const txPlanIds = await Transaction.distinct("dailyPlan", { dailyPlan: { $in: planIds } });
  if (!txPlanIds.length) return null;
  const plans = await DailyPlan.find({ _id: { $in: txPlanIds } }).select("date");
  const times = plans.map((p) => startOfDayTashkent(p.date).getTime());
  return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) };
};

export const transactedRangeForWorkPeriod = (workPeriodId) =>
  transactedRange({ workPeriod: workPeriodId });

export const transactedRangeForCarPrice = (carPriceId) =>
  transactedRange({ carPrice: carPriceId });

// Haydovchining [fromDate, toDate] oralig'idagi tranzaksiyali kunlari sana
// oralig'i (mashina tayinlash davrini tahrirlash/o'chirishni cheklash uchun).
export const transactedRangeForDriverInRange = (driverId, fromDate, toDate) =>
  transactedRange({
    driver: driverId,
    date: { $gte: startOfDayTashkent(fromDate), $lte: startOfDayTashkent(toDate) },
  });

// Agenda job uchun: bitta haydovchining bugungacha planlarini ta'minlash.
export const ensureUpToToday = async (driverId, fromDate) => {
  const driver = await Driver.findById(driverId).populate("car", "plateNumber model");
  if (!driver) return;
  const today = startOfDayTashkent(new Date());
  await ensureRange({ driver, fromDate: startOfDayTashkent(fromDate), toDate: today });
};

// Bir kun uchun tranzaksiya bormi (dam olish belgilashni cheklash uchun).
export const hasTransactionsOnDate = async (driverId, date) => {
  const day = startOfDayTashkent(date);
  return !!(await Transaction.exists({ driver: driverId, date: day }));
};

// Bitta kun planini qayta hisoblaydi (dam olish kuni qo'shilgach/o'chgach sinxron).
export const syncDay = async (driverId, date) => {
  const driver = await Driver.findById(driverId).populate("car", "plateNumber model");
  if (!driver) return;
  const day = startOfDayTashkent(date);
  await ensureRange({ driver, fromDate: day, toDate: day });
};
