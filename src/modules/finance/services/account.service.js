import DailyPlan from "../../../models/dailyPlan.model.js";
import Transaction, { TX_TYPE } from "../../../models/transaction.model.js";
import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import { ensureUpToToday } from "../../payments/services/dailyPlans.service.js";
import * as workPeriods from "../../workPeriods/services/workPeriods.service.js";
import * as cashbackAccrual from "./cashbackAccrual.service.js";
import { coverageByRef } from "./settlement.service.js";
import { toObjectId } from "../../../utils/objectId.js";

const sumMap = (m) => [...m.values()].reduce((s, v) => s + v, 0);

// Haydovchining YAGONA moliyaviy hisobi (§10). Hech narsa saqlanmaydi - barchasi
// manbalardan (kunlik plan, to'lov, depozit, keshbek, jarima, zarar) DERIVED.
//
//   account = KREDIT − DEBET
//   KREDIT  = to'lovlar + depozit kirim + hisoblangan keshbek
//   DEBET   = kunlik reja + jarima + zarar + depozit chiqim + berilgan keshbek
//
//   account ≥ 0  → mavjud buffer (depozit / balans); qarz 0
//   account < 0  → qarz = −account (depozit/keshbek qoplay olmagani)
const sumAmount = async (Model, driverId) => {
  const r = await Model.aggregate([
    { $match: { driver: toObjectId(driverId) } },
    { $group: { _id: null, sum: { $sum: "$amount" } } },
  ]);
  return r[0]?.sum || 0;
};

const signedSum = async (Model, driverId, plusType, minusType) => {
  const r = await Model.aggregate([
    { $match: { driver: toObjectId(driverId) } },
    {
      $group: {
        _id: null,
        plus: { $sum: { $cond: [{ $eq: ["$type", plusType] }, "$amount", 0] } },
        minus: { $sum: { $cond: [{ $eq: ["$type", minusType] }, "$amount", 0] } },
      },
    },
  ]);
  return { plus: r[0]?.plus || 0, minus: r[0]?.minus || 0 };
};

export const computeForDriver = async (driverId) => {
  // Kunlik planlar bugungacha materializatsiya qilingan bo'lsin (majburiyat manbasi).
  const firstWork = await workPeriods.firstStartDate(driverId);
  if (firstWork) await ensureUpToToday(driverId, firstWork);

  const [dailyAgg, pay, dep, cbTx, finesTotal, damagesTotal, accrual, finesCov, damagesCov] =
    await Promise.all([
      DailyPlan.aggregate([
        { $match: { driver: toObjectId(driverId) } },
        { $group: { _id: null, sum: { $sum: "$planAmount" } } },
      ]),
      signedSum(Transaction, driverId, TX_TYPE.PAYMENT, TX_TYPE.REVERSAL),
      signedSum(DepositTransaction, driverId, DEPOSIT_TX_TYPE.IN, DEPOSIT_TX_TYPE.OUT),
      signedSum(CashbackTransaction, driverId, CASHBACK_TX_TYPE.PAYOUT, CASHBACK_TX_TYPE.REVERSAL),
      sumAmount(Fine, driverId),
      sumAmount(Damage, driverId),
      cashbackAccrual.accruedTotal(driverId),
      coverageByRef(driverId, "fine"),
      coverageByRef(driverId, "damage"),
    ]);

  const daily = dailyAgg[0]?.sum || 0;
  const payments = pay.plus - pay.minus;
  const depositIn = dep.plus;
  const depositOut = dep.minus;
  const cashbackAccrued = accrual;
  const cashbackPayout = cbTx.plus - cbTx.minus;
  // Jarima/zarar - qoplanmagan qismi (qoplangani depozit/keshbek chiqimida hisoblangan).
  const fines = finesTotal - sumMap(finesCov);
  const damages = damagesTotal - sumMap(damagesCov);

  const credits = payments + depositIn + cashbackAccrued;
  const debits = daily + fines + damages + depositOut + cashbackPayout;
  const net = credits - debits;

  return {
    daily,
    payments,
    fines,
    damages,
    depositIn,
    depositOut,
    cashbackAccrued,
    cashbackPayout,
    net,
    debt: Math.max(0, -net),
    available: Math.max(0, net),
  };
};

export const availableForDriver = async (driverId) =>
  (await computeForDriver(driverId)).available;

// Depozit MANBA qoldig'i = Σ(in) − Σ(out). Bu haydovchining DEPOZIT hisobida
// haqiqatan yotgan pul (jami account.available'dan FARQLI - unga keshbek/balans
// ham kiradi). Depozitdan naqd YECHISH faqat shu qoldiq bilan cheklanadi: aks holda
// keshbekdan hisoblangan pulni "depozit chiqimi" deb yozib, depozit ledgerini
// manfiyga tushirib bo'lardi.
export const depositBalanceForDriver = async (driverId) => {
  const dep = await signedSum(DepositTransaction, driverId, DEPOSIT_TX_TYPE.IN, DEPOSIT_TX_TYPE.OUT);
  return dep.plus - dep.minus;
};

// Bir nechta haydovchi uchun jami ko'rsatkichlar (Hisobotlar/overview uchun).
export const totalsForDrivers = async (driverIds) => {
  const totals = { debt: 0, available: 0, cashbackAccrued: 0, cashbackPayout: 0, fines: 0, damages: 0 };
  for (const id of driverIds) {
    const a = await computeForDriver(id);
    totals.debt += a.debt;
    totals.available += a.available;
    totals.cashbackAccrued += a.cashbackAccrued;
    totals.cashbackPayout += a.cashbackPayout;
    totals.fines += a.fines;
    totals.damages += a.damages;
  }
  return totals;
};

// To'liq harakatlar tarixi (statement): balansga ta'sir qilgan HAR BIR yozuv -
// kunlik ijara, to'lov, jarima, zarar, depozit kirim/chiqim, keshbek - sana bo'yicha
// tartiblangan, yugurib boruvchi balans bilan. "Nima uchun qarz/balans shunday" savoliga javob.
export const ledgerForDriver = async (driverId) => {
  const firstWork = await workPeriods.firstStartDate(driverId);
  if (firstWork) await ensureUpToToday(driverId, firstWork);

  const [plans, txs, deps, cbs, fines, damages, cbData] = await Promise.all([
    DailyPlan.find({ driver: driverId, planAmount: { $gt: 0 } }).select("date planAmount carSnapshot"),
    Transaction.find({ driver: driverId }).select("date createdAt type amount note"),
    DepositTransaction.find({ driver: driverId }).select("createdAt type amount note reverses"),
    CashbackTransaction.find({ driver: driverId }).select("createdAt type amount note reverses"),
    Fine.find({ driver: driverId }).select("issueDate amount note"),
    Damage.find({ driver: driverId }).select("incidentDate amount note"),
    cashbackAccrual.monthsForDriver(driverId),
  ]);

  // Bekor qilingan depozit/keshbek yozuvlari (reverse tugmasini ko'rsatmaslik uchun).
  const depReversed = new Set(deps.filter((d) => d.reverses).map((d) => String(d.reverses)));
  const cbReversed = new Set(cbs.filter((c) => c.reverses).map((c) => String(c.reverses)));

  const entries = [];
  for (const p of plans)
    entries.push({ date: p.date, kind: "daily", label: "Kunlik ijara", note: p.carSnapshot?.model || "", amount: -p.planAmount });
  for (const t of txs)
    entries.push({
      date: t.createdAt,
      kind: t.type === "payment" ? "payment" : "payment_rev",
      label: t.type === "payment" ? "Kunlik to'lov" : "To'lov bekor qilindi",
      note: t.note || "",
      amount: t.type === "payment" ? t.amount : -t.amount,
    });
  for (const d of deps)
    entries.push({
      date: d.createdAt,
      kind: d.type === "in" ? "deposit_in" : "deposit_out",
      label: d.type === "in" ? "Depozit kirim" : "Depozit chiqim",
      note: d.note || "",
      amount: d.type === "in" ? d.amount : -d.amount,
      txId: String(d._id),
      reversible: !d.reverses && !depReversed.has(String(d._id)),
    });
  for (const c of cbs)
    entries.push({
      date: c.createdAt,
      kind: c.type === "payout" ? "cashback_out" : "cashback_rev",
      label: c.type === "payout" ? "Keshbek berildi" : "Keshbek bekor qilindi",
      note: c.note || "",
      amount: c.type === "payout" ? -c.amount : c.amount,
      ...(c.type === "payout" && {
        txId: String(c._id),
        reversible: !c.reverses && !cbReversed.has(String(c._id)),
      }),
    });
  for (const f of fines)
    entries.push({ date: f.issueDate, kind: "fine", label: "Jarima", note: f.note || "", amount: -f.amount });
  for (const d of damages)
    entries.push({ date: d.incidentDate, kind: "damage", label: "Zarar", note: d.note || "", amount: -d.amount });
  for (const m of cbData.months)
    if (m.accrued > 0)
      entries.push({
        date: m.accrualDate,
        kind: "cashback_accrued",
        label: "Keshbek (hisoblangan)",
        note: "",
        amount: m.accrued,
      });

  // Sanaga ko'ra (eski -> yangi), yugurib boruvchi balansni hisoblaymiz.
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;
  for (const e of entries) {
    running += e.amount;
    e.balance = running;
  }
  entries.reverse(); // ko'rsatish uchun yangidan eskiga
  return entries;
};
