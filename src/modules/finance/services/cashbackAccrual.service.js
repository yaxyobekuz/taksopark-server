import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import DailyPlan from "../../../models/dailyPlan.model.js";
import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent, addMonths, addDays, daysBetween } from "../../../utils/timezone.js";
import { ensureUpToToday } from "../../payments/services/dailyPlans.service.js";

// §8 keshbek hisobi (FAQAT O'QISH). Bu modul account.service'dan ham, cashbacks
// (payout) servisidan ham ishlatiladi — tsiklni oldini olish uchun alohida.

const sod = (d) => startOfDayTashkent(d);

// Keshbek oylari: keshbek ish davri boshlanish sanasidan anchorlanadi (§8).
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

// Keshbek payout'lari oy bo'yicha: paidOut = Σpayout − Σreversal.
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

// Bitta haydovchining keshbek oylari (hisoblangan / berilgan / oylik qoldiq).
export const monthsForDriver = async (driverId) => {
  const driver = await Driver.findById(driverId).select("firstName lastName phone");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  const periods = await WorkPeriod.find({ driver: driverId, tariff: TARIFF.CASHBACK }).sort({ startDate: 1 });
  if (!periods.length) return { driver, months: [], totals: { accrued: 0, paidOut: 0, monthlyAvailable: 0 } };

  await ensureUpToToday(driverId, periods[0].startDate);

  const today = sod(new Date());
  const meta = buildMonthsMeta(periods, today);
  if (!meta.length) return { driver, months: [], totals: { accrued: 0, paidOut: 0, monthlyAvailable: 0 } };

  const fromDate = meta[0].mStart;
  const plans = await DailyPlan.find({
    driver: driverId,
    tariff: TARIFF.CASHBACK,
    date: { $gte: fromDate, $lte: today },
  }).select("date monthlyCashback");

  const paidMap = await paidOutByMonth(driverId);

  const months = meta.map((m) => {
    // §8: kunlik ulush = o'sha kungi oylik narx ÷ oydagi jami kunlar. To'liq oy uchun
    // bu daysInMonth bilan qisqaradi (= oylik narx); qisman oy uchun proporsional.
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
      monthlyAvailable: Math.max(0, accrued - paidOut),
      isComplete: m.isComplete,
    };
  });

  months.sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime());
  const totals = months.reduce(
    (acc, m) => {
      acc.accrued += m.accrued;
      acc.paidOut += m.paidOut;
      acc.monthlyAvailable += m.monthlyAvailable;
      return acc;
    },
    { accrued: 0, paidOut: 0, monthlyAvailable: 0 },
  );

  return { driver, months, totals };
};

// Hisoblangan keshbek jami (account.service uchun).
export const accruedTotal = async (driverId) => {
  const { totals } = await monthsForDriver(driverId);
  return totals.accrued;
};
