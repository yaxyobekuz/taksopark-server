import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { monthsForDriver } from "./cashbackAccrual.service.js";
import * as account from "./account.service.js";

const sod = (d) => startOfDayTashkent(d);

export { monthsForDriver };

// Umumiy sahifa: keshbek davri bor barcha haydovchilar + jami.
// "available" — to'lash mumkin bo'lgan keshbek = oylik qoldiq, lekin haydovchining
// umumiy hisob qoldig'idan (account) oshmaydi (qarzga to'lab bo'lmaydi — §10).
export const summaryAll = async () => {
  const driverIds = await WorkPeriod.distinct("driver", { tariff: TARIFF.CASHBACK });
  const rows = [];
  for (const id of driverIds) {
    const { driver, totals } = await monthsForDriver(id);
    const acc = await account.computeForDriver(id);
    rows.push({
      driver,
      accrued: totals.accrued,
      paidOut: totals.paidOut,
      available: Math.min(totals.monthlyAvailable, acc.available),
    });
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

// Bitta haydovchining keshbek oylari + account qoldig'i bilan to'ldirilgan "available".
export const detailForDriver = async (driverId) => {
  const [data, acc, ledger] = await Promise.all([
    monthsForDriver(driverId),
    account.computeForDriver(driverId),
    account.ledgerForDriver(driverId),
  ]);
  // Account qoldig'ini oylar bo'yicha (eng yangi oydan) taqsimlab "available" beramiz.
  let budget = acc.available;
  const months = data.months.map((m) => {
    const available = Math.max(0, Math.min(m.monthlyAvailable, budget));
    budget -= available;
    return { ...m, available };
  });
  return {
    driver: data.driver,
    months,
    totals: { ...data.totals, available: Math.max(0, Math.min(data.totals.monthlyAvailable, acc.available)) },
    accountDebt: acc.debt,
    account: acc,
    ledger,
  };
};

export const transactionsForDriver = (driverId) =>
  CashbackTransaction.find({ driver: driverId })
    .populate("createdBy", "fullName username")
    .sort({ createdAt: -1 });

// Keshbek payout (avans). Oylik qoldiqdan VA umumiy hisob qoldig'idan oshmaydi.
export const createPayout = async (driverId, { monthStart, amount, note }, currentUser) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, "Summa musbat bo'lishi kerak");
  }
  const target = sod(monthStart);
  const { months } = await monthsForDriver(driverId);
  const month = months.find((m) => m.monthStart.getTime() === target.getTime());
  if (!month) throw new ApiError(404, "Keshbek oyi topilmadi");

  const acc = await account.computeForDriver(driverId);
  const cap = Math.min(month.monthlyAvailable, acc.available);
  if (value > cap) {
    throw new ApiError(409, `To'lov mavjud keshbek qoldig'idan (${cap}) oshmasligi kerak`);
  }

  await CashbackTransaction.create({
    driver: driverId,
    monthStart: target,
    type: CASHBACK_TX_TYPE.PAYOUT,
    amount: value,
    note: note || "",
    createdBy: currentUser._id,
  });
  return detailForDriver(driverId);
};

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
  return detailForDriver(String(original.driver));
};
