import Oylik from "../../../models/oylik.model.js";
import Driver from "../../../models/driver.model.js";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import Transaction, { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../../../models/transaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS, TARIFF_CONFIG } from "../../../constants/tariffs.js";
import { GRACE_DAYS } from "../../../constants/oyliklar.js";
import { startOfDayTashkent, addDays, addMonths, endOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";

// Bir oylik davrining tugash/muddat sanalarini boshlanish sanasidan hisoblaydi.
const computeOylikWindow = (startDate) => {
  const start = startOfDayTashkent(startDate);
  const nextStart = startOfDayTashkent(addMonths(start, 1));
  const endDate = endOfDayTashkent(addDays(nextStart, -1));
  const dueDate = endOfDayTashkent(addDays(endDate, GRACE_DAYS));
  return { startDate: start, endDate, dueDate };
};

// Haydovchining salary fazasi qaysi kundan boshlanishini qaytaradi.
const salaryStartDate = (driver) => {
  const cfg = TARIFF_CONFIG[TARIFFS.NO_DEPOSIT];
  if (driver.trialEndedAt) return startOfDayTashkent(driver.trialEndedAt);
  return startOfDayTashkent(addDays(driver.startDate, cfg.trialDays));
};

// Salary fazasi boshidan asOf sanasigacha barcha yetishmagan oyliklarni yaratadi.
export const ensureOyliklar = async (driver, asOf = new Date()) => {
  if (driver.tariff !== TARIFFS.NO_DEPOSIT) return;
  if (driver.status !== "active" || !driver.car) return;

  const ref = startOfDayTashkent(asOf);
  let { startDate } = computeOylikWindow(salaryStartDate(driver));

  const existing = await Oylik.find({ driver: driver._id }).sort({ oylikNumber: 1 });
  let count = existing.length;

  // Eng oxirgi oylikdan keyingi oydan davom etamiz.
  if (count > 0) {
    startDate = startOfDayTashkent(addDays(existing[count - 1].endDate, 1));
  }

  const cfg = TARIFF_CONFIG[TARIFFS.NO_DEPOSIT];
  while (startDate <= ref) {
    const win = computeOylikWindow(startDate);
    await Oylik.create({
      driver: driver._id,
      car: driver.car,
      oylikNumber: count + 1,
      startDate: win.startDate,
      endDate: win.endDate,
      dueDate: win.dueDate,
      expectedPlanTotal: 0,
      salary: cfg.monthlySalary,
    });
    count += 1;
    startDate = startOfDayTashkent(addDays(win.endDate, 1));
  }
};

// Sinov tugash sanasi o'zgarganda 1-oylik sanalarini moslaydi.
export const syncFirstOylikStart = async (driver, trialEndDate) => {
  if (driver.tariff !== TARIFFS.NO_DEPOSIT) return;
  if (driver.status !== "active" || !driver.car) return;

  const first = await Oylik.findOne({ driver: driver._id }).sort({ oylikNumber: 1 });
  if (!first) {
    await ensureOyliklar(driver, new Date());
    return;
  }
  if (first.oylikNumber === 1) {
    const win = computeOylikWindow(trialEndDate);
    first.startDate = win.startDate;
    first.endDate = win.endDate;
    first.dueDate = win.dueDate;
    await first.save();
  }
};

// Berilgan sana qaysi oylik davriga tushishini topadi (jarima/zarar bog'lash uchun).
export const oylikForDate = async (driverId, date) => {
  const ref = startOfDayTashkent(date);
  return Oylik.findOne({
    driver: driverId,
    startDate: { $lte: ref },
    endDate: { $gte: ref },
  });
};

export const list = async ({ driverId, late, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (late === true || late === "true") {
    filter.dueDate = { $lt: new Date() };
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Oylik.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model")
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit),
    Oylik.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const oylik = await Oylik.findById(id)
    .populate("driver", "firstName lastName phone tariff")
    .populate("car", "plateNumber model")
    .populate("payouts.createdBy", "fullName username");
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  const [payments, fines, damages] = await Promise.all([
    DailyPayment.find({ oylik: oylik._id }).sort({ date: -1 }),
    Fine.find({ oylik: oylik._id }).sort({ issueDate: -1 }),
    Damage.find({ oylik: oylik._id }).sort({ incidentDate: -1 }),
  ]);
  return { oylik, ledger: { payments, fines, damages, payouts: oylik.payouts } };
};

export const currentForDriver = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  await ensureOyliklar(driver, new Date());
  const oylik = await Oylik.findOne({ driver: driver._id }).sort({ oylikNumber: -1 });
  return { driver, oylik };
};

export const statementForDriver = async (driverId) => {
  const driver = await Driver.findById(driverId).populate("car", "plateNumber model");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  if (driver.tariff === TARIFFS.NO_DEPOSIT && driver.status === "active") {
    await ensureOyliklar(driver, new Date());
  }

  const oyliklar = await Oylik.find({ driver: driverId }).sort({ oylikNumber: 1 }).lean({ virtuals: true });

  let running = 0;
  const rows = oyliklar.map((o) => {
    const planDeficit = Math.max(0, o.expectedPlanTotal - o.paidTotal);
    const deductions = planDeficit + o.finesTotal + o.damagesTotal;
    const earned = Math.max(0, o.salary - deductions);
    const remaining = Math.max(0, earned - o.paidOut);
    running += earned - o.paidOut;
    return {
      ...o,
      planDeficit,
      deductions,
      earnedPayout: earned,
      remainingPayout: remaining,
      runningBalance: running,
    };
  });

  const totals = oyliklar.reduce(
    (acc, o) => ({
      salary: acc.salary + o.salary,
      paidOut: acc.paidOut + o.paidOut,
      fines: acc.fines + o.finesTotal,
      damages: acc.damages + o.damagesTotal,
      collected: acc.collected + o.paidTotal,
    }),
    { salary: 0, paidOut: 0, fines: 0, damages: 0, collected: 0 },
  );

  return { driver, totals, rows, currentBalance: running };
};

const earnedPayoutOf = (oylik) => {
  const planDeficit = Math.max(0, oylik.expectedPlanTotal - oylik.paidTotal);
  const deductions = planDeficit + oylik.finesTotal + oylik.damagesTotal;
  return Math.max(0, oylik.salary - deductions);
};

export const addPayout = async (id, body, currentUser) => {
  const oylik = await Oylik.findById(id);
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  if (!body.amount || body.amount <= 0) {
    throw new ApiError(400, "To'lov summasi noto'g'ri");
  }

  const remaining = Math.max(0, earnedPayoutOf(oylik) - oylik.paidOut);
  if (body.amount > remaining) {
    throw new ApiError(400, `Hisoblangan haqdan oshib ketdi. Qoldi: ${remaining}`);
  }

  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
  oylik.payouts.push({
    amount: body.amount,
    paidAt,
    note: body.note || "",
    createdBy: currentUser._id,
  });
  oylik.paidOut += body.amount;
  await oylik.save();
  const lastPayout = oylik.payouts[oylik.payouts.length - 1];

  await Transaction.create({
    type: TRANSACTION_TYPES.EXPENSE,
    source: TRANSACTION_SOURCES.OYLIK_PAYOUT,
    amount: body.amount,
    date: paidAt,
    driver: oylik.driver,
    oylik: oylik._id,
    payoutId: lastPayout._id,
    note: body.note || "",
    createdBy: currentUser._id,
  });

  return oylik;
};

export const updatePayout = async (oylikId, payoutId, body) => {
  const oylik = await Oylik.findById(oylikId);
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  const payout = oylik.payouts.id(payoutId);
  if (!payout) throw new ApiError(404, "To'lov topilmadi");

  if (body.amount !== undefined) {
    if (body.amount <= 0) throw new ApiError(400, "To'lov summasi noto'g'ri");
    const otherPaid = oylik.paidOut - payout.amount;
    const remaining = Math.max(0, earnedPayoutOf(oylik) - otherPaid);
    if (body.amount > remaining) {
      throw new ApiError(400, `Hisoblangan haqdan oshib ketdi. Qoldi: ${remaining}`);
    }
    oylik.paidOut = otherPaid + body.amount;
    payout.amount = body.amount;
  }
  if (body.paidAt !== undefined) payout.paidAt = new Date(body.paidAt);
  if (body.note !== undefined) payout.note = body.note;
  await oylik.save();

  await Transaction.updateOne(
    { payoutId: payout._id },
    { $set: { amount: payout.amount, date: payout.paidAt, note: payout.note || "" } },
  );

  return oylik;
};

export const removePayout = async (oylikId, payoutId) => {
  const oylik = await Oylik.findById(oylikId);
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  const payout = oylik.payouts.id(payoutId);
  if (!payout) throw new ApiError(404, "To'lov topilmadi");

  oylik.paidOut = Math.max(0, oylik.paidOut - payout.amount);
  payout.deleteOne();
  await oylik.save();

  await Transaction.deleteMany({ payoutId });
  return oylik;
};
