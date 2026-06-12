import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import DailyPlan from "../../../models/dailyPlan.model.js";
import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent, addMonths, addDays, daysBetween } from "../../../utils/timezone.js";
import { ensureUpToToday } from "../../payments/services/dailyPlans.service.js";

const sod = (d) => startOfDayTashkent(d);

// Keshbek oylari: keshbek ish davri boshlanish sanasidan anchorlanadi (§8,
// "ish boshlash sanasidan"). Oy uzunligi = o'sha oyning kunlari (addMonths).
const buildMonthsMeta = (periods, today) => {
  const months = [];
  for (const period of periods) {
    const pStart = sod(period.startDate);
    const pEnd = period.endDate ? sod(period.endDate) : null;
    const effEnd = pEnd && pEnd.getTime() < today.getTime() ? pEnd : today;
    if (pStart.getTime() > effEnd.getTime()) continue;

    let k = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const mStart = sod(addMonths(pStart, k));
      if (mStart.getTime() > effEnd.getTime()) break;
      const mEndExclusive = sod(addMonths(pStart, k + 1));
      const mEnd = sod(addDays(mEndExclusive, -1));
      const daysInMonth = daysBetween(mStart, mEndExclusive);
      const rangeEnd = mEnd.getTime() < effEnd.getTime() ? mEnd : effEnd;
      months.push({ mStart, mEnd, daysInMonth, rangeEnd, isComplete: mEnd.getTime() <= today.getTime() });
      k += 1;
    }
  }
  return months;
};

// Keshbek payout'lari oy bo'yicha guruhlanadi: paidOut = Σpayout − Σreversal.
const paidOutByMonth = async (driverId) => {
  const txs = await CashbackTransaction.find({ driver: driverId });
  const map = new Map();
  for (const t of txs) {
    const key = sod(t.monthStart).getTime();
    const sign = t.type === CASHBACK_TX_TYPE.PAYOUT ? 1 : -1;
    map.set(key, (map.get(key) || 0) + sign * t.amount);
  }
  return map;
};

// Bitta haydovchining keshbek oylari (hisoblangan/to'langan/qoldiq).
export const monthsForDriver = async (driverId) => {
  const driver = await Driver.findById(driverId).select("firstName lastName phone");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  const periods = await WorkPeriod.find({ driver: driverId, tariff: TARIFF.CASHBACK }).sort({ startDate: 1 });
  if (!periods.length) return { driver, months: [], totals: { accrued: 0, paidOut: 0, available: 0 } };

  // Kunlik planlar mavjudligini ta'minlaymiz (snapshot manbasi — §8).
  await ensureUpToToday(driverId, periods[0].startDate);

  const today = sod(new Date());
  const meta = buildMonthsMeta(periods, today);
  if (!meta.length) return { driver, months: [], totals: { accrued: 0, paidOut: 0, available: 0 } };

  // Keshbek tarifidagi barcha kunlik planlar (faqat kerakli oraliq).
  const fromDate = meta[0].mStart;
  const plans = await DailyPlan.find({
    driver: driverId,
    tariff: TARIFF.CASHBACK,
    date: { $gte: fromDate, $lte: today },
  }).select("date monthlyCashback");

  const paidMap = await paidOutByMonth(driverId);

  const months = meta.map((m) => {
    // §8: kunlik ulush = o'sha kungi oylik keshbek narxi ÷ oydagi jami kunlar.
    // Oylik = ulushlar yig'indisi = (Σ monthlyCashback) ÷ daysInMonth.
    let sumRates = 0;
    for (const p of plans) {
      const t = sod(p.date).getTime();
      if (t >= m.mStart.getTime() && t <= m.rangeEnd.getTime()) sumRates += p.monthlyCashback || 0;
    }
    const accrued = m.daysInMonth > 0 ? Math.round(sumRates / m.daysInMonth) : 0;
    const paidOut = paidMap.get(m.mStart.getTime()) || 0;
    return {
      monthStart: m.mStart,
      monthEnd: m.mEnd,
      daysInMonth: m.daysInMonth,
      accrued,
      paidOut,
      available: Math.max(0, accrued - paidOut),
      isComplete: m.isComplete,
    };
  });

  months.sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime());
  const totals = months.reduce(
    (acc, m) => {
      acc.accrued += m.accrued;
      acc.paidOut += m.paidOut;
      acc.available += m.available;
      return acc;
    },
    { accrued: 0, paidOut: 0, available: 0 },
  );

  return { driver, months, totals };
};

// Umumiy sahifa: keshbek davri bor barcha haydovchilar + jami ko'rsatkichlar.
export const summaryAll = async () => {
  const driverIds = await WorkPeriod.distinct("driver", { tariff: TARIFF.CASHBACK });
  const rows = [];
  for (const id of driverIds) {
    const { driver, totals } = await monthsForDriver(id);
    rows.push({ driver, ...totals });
  }
  rows.sort((a, b) => b.available - a.available);
  const totals = rows.reduce(
    (acc, r) => {
      acc.accrued += r.accrued;
      acc.paidOut += r.paidOut;
      acc.available += r.available;
      return acc;
    },
    { accrued: 0, paidOut: 0, available: 0 },
  );
  return { rows, totals };
};

// Keshbek payout (avans) — qoldiqdan oshmasligi kerak.
export const createPayout = async (driverId, { monthStart, amount, note }, currentUser) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, "Summa musbat bo'lishi kerak");
  }
  const target = sod(monthStart);
  const { months } = await monthsForDriver(driverId);
  const month = months.find((m) => m.monthStart.getTime() === target.getTime());
  if (!month) throw new ApiError(404, "Keshbek oyi topilmadi");
  if (value > month.available) {
    throw new ApiError(409, `To'lov mavjud keshbek qoldig'idan (${month.available}) oshmasligi kerak`);
  }

  await CashbackTransaction.create({
    driver: driverId,
    monthStart: target,
    type: CASHBACK_TX_TYPE.PAYOUT,
    amount: value,
    note: note || "",
    createdBy: currentUser._id,
  });
  return monthsForDriver(driverId);
};

export const transactionsForDriver = (driverId) =>
  CashbackTransaction.find({ driver: driverId })
    .populate("createdBy", "fullName username")
    .sort({ createdAt: -1 });

export const reversePayout = async (transactionId, currentUser) => {
  const original = await CashbackTransaction.findById(transactionId);
  if (!original) throw new ApiError(404, "Tranzaksiya topilmadi");
  if (original.type === CASHBACK_TX_TYPE.REVERSAL) {
    throw new ApiError(409, "Tuzatuvchi tranzaksiyani qayta tuzatib bo'lmaydi");
  }
  const already = await CashbackTransaction.exists({ reverses: original._id });
  if (already) throw new ApiError(409, "Bu tranzaksiya allaqachon bekor qilingan");

  await CashbackTransaction.create({
    driver: original.driver,
    monthStart: original.monthStart,
    type: CASHBACK_TX_TYPE.REVERSAL,
    amount: original.amount,
    reverses: original._id,
    note: "Tuzatish",
    createdBy: currentUser._id,
  });
  return monthsForDriver(String(original.driver));
};
