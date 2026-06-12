import WorkPeriod from "../../../models/workPeriod.model.js";
import { startOfDayTashkent, addMonths, addDays } from "../../../utils/timezone.js";
import { monthView } from "../../payments/services/dailyPlans.service.js";
import * as cashbacks from "./cashbacks.service.js";
import * as deposits from "./deposits.service.js";

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

// Hisobotlar sahifasi: tanlangan oy bo'yicha umumiy moliyaviy manzara.
export const overview = async ({ year, month }) => {
  const [payments, cashbackSummary, depositSummary] = await Promise.all([
    dailyPaymentsSummary({ year, month }),
    cashbacks.summaryAll(),
    deposits.summaryAll(),
  ]);

  return {
    payments: payments.totals,
    cashback: cashbackSummary.totals,
    deposit: { total: depositSummary.total },
    driverCount: payments.rows.length,
  };
};
