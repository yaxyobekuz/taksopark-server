import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import Transaction, { TX_TYPE } from "../../../models/transaction.model.js";
import DailyPlan from "../../../models/dailyPlan.model.js";
import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import Driver from "../../../models/driver.model.js";
import { startOfDayTashkent, addMonths, addDays, dateKeyTashkent } from "../../../utils/timezone.js";
import { monthView, dayView } from "../../payments/services/dailyPlans.service.js";
import * as cashbackAccrual from "./cashbackAccrual.service.js";
import { settleDriver } from "./settlement.service.js";

const monthBounds = (year, month) => {
  const monthStart = startOfDayTashkent(new Date(Date.UTC(year, month - 1, 1)));
  const nextMonthStart = startOfDayTashkent(addMonths(monthStart, 1));
  const monthEnd = startOfDayTashkent(addDays(nextMonthStart, -1));
  return { monthStart, monthEnd };
};

// Yarim-ochiq oraliq [start, nextStart) - oylik aggregate filtrlari uchun (vaqt
// komponentli createdAt larni ham to'g'ri qamrab oladi).
const monthRange = (year, month) => {
  const start = startOfDayTashkent(new Date(Date.UTC(year, month - 1, 1)));
  const nextStart = startOfDayTashkent(addMonths(start, 1));
  return { start, nextStart };
};

const PENALTY_KINDS = ["fine", "damage"];

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

// Umumiy "Kunlik to'lovlar" sahifasi (kun bo'yicha): tanlangan BITTA kunda to'lov
// majburiyati bo'lgan har bir haydovchining kunlik plani - reja/to'langan/qarz bilan.
// Har bir qatorda haydovchining `autoSettleDaily` holati ham bor (modal toggle uchun).
export const dailyPlansForDate = async ({ date }) => {
  const day = startOfDayTashkent(new Date(`${date}T00:00:00.000Z`));
  // Shu kunni qamragan ish davri bor haydovchilar.
  const driverIds = await WorkPeriod.distinct("driver", {
    startDate: { $lte: day },
    $or: [{ endDate: null }, { endDate: { $gte: day } }],
  });

  const rows = [];
  const totals = { planTotal: 0, paidTotal: 0, debtTotal: 0 };
  for (const id of driverIds) {
    await settleDriver(id);
    const { driver, plan } = await dayView({ driverId: id, date: day });
    if (!plan) continue;
    rows.push({
      ...plan,
      driver: {
        _id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        phone: driver.phone,
        autoSettleDaily: driver.autoSettleDaily !== false,
      },
    });
    totals.planTotal += plan.planAmount;
    totals.paidTotal += plan.paidAmount;
    totals.debtTotal += plan.debt;
  }

  // Qarzi borlar tepada, keyin ism bo'yicha.
  rows.sort((a, b) => {
    if (b.debt !== a.debt) return b.debt - a.debt;
    return (a.driver.firstName || "").localeCompare(b.driver.firstName || "");
  });

  return { rows, totals };
};

// Kunlik to'lov pul oqimi: tanlangan oy, kun bo'yicha kirim (to'lov) va chiqim
// (tuzatuvchi reversal). Kun bo'yicha - line chart uchun. Plan kuni (`date`) bo'yicha.
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

// ─────────────────────────────────────────────────────────────────────────────
// UCHTA HAMYON modeli (egasi uchun aniq hisobot). Hammasi DERIVED - hech narsa
// saqlanmaydi, har safar tranzaksiyalardan qayta hisoblanadi (§10 ANTI-QOIDA).
//
// 1) ASOSIY (P&L): Tushum (kunlik ijara to'lovlari) − Keshbek chiqim = Sof foyda.
// 2) DEPOZIT: haydovchining garovi - taksoparkka tegishli emas, foydaga kirmaydi.
// 3) JARIMA/ZARAR: taksopark qoplaydi → haydovchi qaytaradi; foydaga kirmaydi.
// ─────────────────────────────────────────────────────────────────────────────

// 1-hamyon (P&L). `range` berilsa shu oy, bo'lmasa umumiy (all-time).
//   Tushum   = Σ Transaction(payment − reversal). Naqd/depozitdan/keshbekdan
//              qoplangan har qanday ijara shu yerda (settlement `Transaction{source}`
//              yaratadi). Jarima/zarar qoplashlari `Transaction` yaratmaydi → bu yerda yo'q.
//   Keshbek  = Σ CashbackTransaction(payout, coverage.kind ∉ {fine,damage}) − reversal.
//   chiqim     (naqd avans + ijarani qoplagan keshbek; jarima/zararni qoplagan keshbek 3-hamyonda)
const pnlFigures = async (range) => {
  const txMatch = range ? { date: { $gte: range.start, $lt: range.nextStart } } : {};
  const cbPipeline = [{ $addFields: { eff: { $ifNull: ["$coverage.date", "$createdAt"] } } }];
  if (range) cbPipeline.push({ $match: { eff: { $gte: range.start, $lt: range.nextStart } } });
  cbPipeline.push({
    $group: {
      _id: null,
      payout: {
        $sum: {
          $cond: [
            {
              $and: [
                { $eq: ["$type", CASHBACK_TX_TYPE.PAYOUT] },
                { $not: [{ $in: [{ $ifNull: ["$coverage.kind", null] }, PENALTY_KINDS] }] },
              ],
            },
            "$amount",
            0,
          ],
        },
      },
      reversal: { $sum: { $cond: [{ $eq: ["$type", CASHBACK_TX_TYPE.REVERSAL] }, "$amount", 0] } },
    },
  });

  const [txAgg, cbAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: txMatch },
      {
        $group: {
          _id: null,
          payment: { $sum: { $cond: [{ $eq: ["$type", TX_TYPE.PAYMENT] }, "$amount", 0] } },
          reversal: { $sum: { $cond: [{ $eq: ["$type", TX_TYPE.REVERSAL] }, "$amount", 0] } },
        },
      },
    ]),
    CashbackTransaction.aggregate(cbPipeline),
  ]);

  const revenue = (txAgg[0]?.payment || 0) - (txAgg[0]?.reversal || 0);
  const cashbackExpense = (cbAgg[0]?.payout || 0) - (cbAgg[0]?.reversal || 0);
  return { revenue, cashbackExpense, net: revenue - cashbackExpense };
};

// Q3: ijara qarzi bor haydovchilar (jarima/zarar bu yerga KIRMAYDI). Har haydovchi
// uchun qarz = Σ planAmount − (Σ payment − Σ reversal). Depozit/keshbek bilan
// qoplangani allaqachon `payment` bo'lib ketgani uchun bu "haqiqatan to'lanmagan ijara".
const debtors = async () => {
  const [planAgg, payAgg] = await Promise.all([
    DailyPlan.aggregate([{ $group: { _id: "$driver", plan: { $sum: "$planAmount" } } }]),
    Transaction.aggregate([
      {
        $group: {
          _id: "$driver",
          payment: { $sum: { $cond: [{ $eq: ["$type", TX_TYPE.PAYMENT] }, "$amount", 0] } },
          reversal: { $sum: { $cond: [{ $eq: ["$type", TX_TYPE.REVERSAL] }, "$amount", 0] } },
        },
      },
    ]),
  ]);

  const paidMap = new Map(payAgg.map((r) => [String(r._id), r.payment - r.reversal]));
  const debts = [];
  for (const p of planAgg) {
    const debt = p.plan - (paidMap.get(String(p._id)) || 0);
    if (debt > 0) debts.push({ driverId: p._id, debt });
  }
  debts.sort((a, b) => b.debt - a.debt);

  const drivers = await Driver.find({ _id: { $in: debts.map((d) => d.driverId) } }).select(
    "firstName lastName phone",
  );
  const dmap = new Map(drivers.map((d) => [String(d._id), d]));
  const rows = debts.map((d) => {
    const dr = dmap.get(String(d.driverId));
    return {
      driver: dr
        ? { _id: dr._id, firstName: dr.firstName, lastName: dr.lastName, phone: dr.phone }
        : { _id: d.driverId },
      debt: d.debt,
    };
  });
  const total = rows.reduce((s, r) => s + r.debt, 0);
  return { total, rows };
};

// 2-hamyon: barcha haydovchilar bo'yicha hozir ushlab turilgan garov = Σ(in − out).
const depositTotal = async () => {
  const [agg] = await DepositTransaction.aggregate([
    {
      $group: {
        _id: null,
        in: { $sum: { $cond: [{ $eq: ["$type", DEPOSIT_TX_TYPE.IN] }, "$amount", 0] } },
        out: { $sum: { $cond: [{ $eq: ["$type", DEPOSIT_TX_TYPE.OUT] }, "$amount", 0] } },
      },
    },
  ]);
  return (agg?.in || 0) - (agg?.out || 0);
};

// Keshbek hamyoni: hisoblangan / berilgan / qoldiq (= hozir qancha keshbek bor /
// berishim kerak). `paidOut` BARCHA payout (jarima/zararni qoplagani ham) - bu
// keshbek qoldig'ining haqiqiy kamayishi.
const cashbackWallet = async () => {
  const driverIds = await WorkPeriod.distinct("driver", { tariff: TARIFF.CASHBACK });
  let accrued = 0;
  for (const id of driverIds) accrued += await cashbackAccrual.accruedTotal(id);

  const [agg] = await CashbackTransaction.aggregate([
    {
      $group: {
        _id: null,
        payout: { $sum: { $cond: [{ $eq: ["$type", CASHBACK_TX_TYPE.PAYOUT] }, "$amount", 0] } },
        reversal: { $sum: { $cond: [{ $eq: ["$type", CASHBACK_TX_TYPE.REVERSAL] }, "$amount", 0] } },
      },
    },
  ]);
  const paidOut = (agg?.payout || 0) - (agg?.reversal || 0);
  return { accrued, paidOut, outstanding: accrued - paidOut };
};

// 3-hamyon: jarima/zarar. fronted = taksopark qoplagan jami; repaid = haydovchidan
// (depozit/keshbek coverage orqali) qaytarilgani; outstanding = qoldiq.
const penaltyWallet = async () => {
  const [fineAgg, damageAgg, depRep, cbRep] = await Promise.all([
    Fine.aggregate([{ $group: { _id: null, s: { $sum: "$amount" } } }]),
    Damage.aggregate([{ $group: { _id: null, s: { $sum: "$amount" } } }]),
    DepositTransaction.aggregate([
      { $match: { type: DEPOSIT_TX_TYPE.OUT, "coverage.kind": { $in: PENALTY_KINDS } } },
      { $group: { _id: null, s: { $sum: "$amount" } } },
    ]),
    CashbackTransaction.aggregate([
      { $match: { type: CASHBACK_TX_TYPE.PAYOUT, "coverage.kind": { $in: PENALTY_KINDS } } },
      { $group: { _id: null, s: { $sum: "$amount" } } },
    ]),
  ]);
  const fronted = (fineAgg[0]?.s || 0) + (damageAgg[0]?.s || 0);
  const repaid = (depRep[0]?.s || 0) + (cbRep[0]?.s || 0);
  return { fronted, repaid, outstanding: fronted - repaid };
};

// Hisobotlar sahifasi: uchta hamyon + 6 ta savolga javob (oy + umumiy).
export const overview = async ({ year, month }) => {
  const range = monthRange(year, month);
  const [monthPnl, totalPnl, debtorsData, depTotal, cbWallet, penalties, flow] = await Promise.all([
    pnlFigures(range),
    pnlFigures(),
    debtors(),
    depositTotal(),
    cashbackWallet(),
    penaltyWallet(),
    dailyPaymentFlow({ year, month }),
  ]);

  return {
    period: { year, month },
    // 1-hamyon (P&L): tushum − keshbek chiqim = sof foyda.
    profit: { month: monthPnl, total: totalPnl },
    // Q3: ijara qarzi + qarzdorlar ro'yxati.
    debtors: debtorsData,
    // 2-hamyon: ushlab turilgan garov (foydaga kirmaydi).
    deposit: { total: depTotal },
    // Keshbek hamyoni: hisoblangan/berilgan/qoldiq.
    cashback: cbWallet,
    // 3-hamyon: jarima/zarar (foydaga kirmaydi).
    penalties,
    // Oylik kunlik to'lov oqimi (chart).
    flow,
  };
};
