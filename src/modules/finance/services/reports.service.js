import WorkPeriod from "../../../models/workPeriod.model.js";
import Transaction, { TX_TYPE } from "../../../models/transaction.model.js";
import { startOfDayTashkent, addMonths, addDays, dateKeyTashkent } from "../../../utils/timezone.js";
import { monthView } from "../../payments/services/dailyPlans.service.js";
import * as cashbacks from "./cashbacks.service.js";
import * as deposits from "./deposits.service.js";
import * as account from "./account.service.js";
import { settleDriver } from "./settlement.service.js";

const monthBounds = (year, month) => {
  const monthStart = startOfDayTashkent(new Date(Date.UTC(year, month - 1, 1)));
  const nextMonthStart = startOfDayTashkent(addMonths(monthStart, 1));
  const monthEnd = startOfDayTashkent(addDays(nextMonthStart, -1));
  return { monthStart, monthEnd };
};

// O'sha oyda ish davri bor haydovchilar (ortiqcha hisob-kitobning oldini olamiz).
const driversWithWorkInMonth = async (monthStart, monthEnd) =>
  WorkPeriod.distinct("driver", {
    startDate: { $lte: monthEnd },
    $or: [{ endDate: null }, { endDate: { $gte: monthStart } }],
  });

// Umumiy "Kunlik to'lovlar" sahifasi: har bir haydovchi uchun oylik reja/to'langan/qarz.
export const dailyPaymentsSummary = async ({ year, month }) => {
  const { monthStart, monthEnd } = monthBounds(year, month);
  const driverIds = await driversWithWorkInMonth(monthStart, monthEnd);

  const rows = [];
  for (const id of driverIds) {
    const { driver, summary } = await monthView({ driverId: id, year, month });
    if (summary.planTotal === 0 && summary.paidTotal === 0) continue;
    rows.push({
      driver: {
        _id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        phone: driver.phone,
      },
      ...summary,
    });
  }
  rows.sort((a, b) => b.debtTotal - a.debtTotal);

  const totals = rows.reduce(
    (acc, r) => {
      acc.planTotal += r.planTotal;
      acc.paidTotal += r.paidTotal;
      acc.debtTotal += r.debtTotal;
      return acc;
    },
    { planTotal: 0, paidTotal: 0, debtTotal: 0 },
  );

  return { rows, totals };
};

// Umumiy "Kunlik to'lovlar" sahifasi: tanlangan oydagi HAR BIR kunlik plan
// (haydovchi + kun) - reja/to'langan/qarz bilan. Oylik jami emas, kunma-kun.
export const dailyPlansForMonth = async ({ year, month }) => {
  const { monthStart, monthEnd } = monthBounds(year, month);
  const driverIds = await driversWithWorkInMonth(monthStart, monthEnd);

  const rows = [];
  const totals = { planTotal: 0, paidTotal: 0, debtTotal: 0 };
  for (const id of driverIds) {
    await settleDriver(id);
    const { driver, plans } = await monthView({ driverId: id, year, month });
    for (const p of plans) {
      rows.push({
        ...p,
        driver: {
          _id: driver._id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          phone: driver.phone,
        },
      });
      totals.planTotal += p.planAmount;
      totals.paidTotal += p.paidAmount;
      totals.debtTotal += p.debt;
    }
  }

  // Kun bo'yicha (yangi -> eski), keyin haydovchi bo'yicha.
  rows.sort((a, b) => {
    const d = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (d !== 0) return d;
    return (a.driver.firstName || "").localeCompare(b.driver.firstName || "");
  });

  return { rows, totals };
};

// Kunlik to'lov pul oqimi: tanlangan oy, kun bo'yicha kirim (to'lov) va chiqim
// (tuzatuvchi reversal). Kun bo'yicha — line chart uchun. Plan kuni (`date`) bo'yicha.
export const dailyPaymentFlow = async ({ year, month }) => {
  const { monthStart, monthEnd } = monthBounds(year, month);
  const grouped = await Transaction.aggregate([
    { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
    {
      $group: {
        _id: "$date",
        income: { $sum: { $cond: [{ $eq: ["$type", TX_TYPE.PAYMENT] }, "$amount", 0] } },
        expense: { $sum: { $cond: [{ $eq: ["$type", TX_TYPE.REVERSAL] }, "$amount", 0] } },
      },
    },
  ]);
  const byKey = new Map(
    grouped.map((g) => [dateKeyTashkent(g._id), { income: g.income, expense: g.expense }]),
  );

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const series = [];
  const totals = { income: 0, expense: 0 };
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dayDate = startOfDayTashkent(new Date(Date.UTC(year, month - 1, d)));
    const key = dateKeyTashkent(dayDate);
    const v = byKey.get(key) || { income: 0, expense: 0 };
    series.push({ dateKey: key, day: d, income: v.income, expense: v.expense });
    totals.income += v.income;
    totals.expense += v.expense;
  }
  return { series, totals };
};

// Hisobotlar sahifasi: tanlangan oy bo'yicha umumiy moliyaviy manzara.
export const overview = async ({ year, month }) => {
  const allDriverIds = await WorkPeriod.distinct("driver", {});
  const [payments, cashbackSummary, depositSummary, accTotals, flow] = await Promise.all([
    dailyPaymentsSummary({ year, month }),
    cashbacks.summaryAll(),
    deposits.summaryAll(),
    account.totalsForDrivers(allDriverIds),
    dailyPaymentFlow({ year, month }),
  ]);

  return {
    // Oylik (gross) — tanlangan oy uchun reja/to'langan.
    payments: payments.totals,
    // Kunlik to'lov kirim/chiqim — oylik jami + kun bo'yicha seriya (chart).
    flow,
    // NET qarz — depozit/keshbek bilan qoplangandan keyingi haqiqiy qarz (§10).
    netDebt: accTotals.debt,
    available: accTotals.available,
    cashback: cashbackSummary.totals,
    deposit: { total: depositSummary.total },
    driverCount: payments.rows.length,
  };
};
