import DailyPlan from "../../../models/dailyPlan.model.js";
import Transaction, { TX_TYPE, TX_SOURCE } from "../../../models/transaction.model.js";
import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import { ensureUpToToday, paidByPlan } from "../../payments/services/dailyPlans.service.js";
import * as workPeriods from "../../workPeriods/services/workPeriods.service.js";
import * as cashbackAccrual from "./cashbackAccrual.service.js";

// §10 QOPLASH (settlement): haydovchining qoplanmagan majburiyatlarini (eng eskidan)
// mavjud DEPOZIT, so'ng KESHBEK bilan avtomatik yopadi. Har qoplash AYNIQ yoziladi:
//   - manbadan chiqim (depozit "out" / keshbek "payout") — coverage refi bilan
//   - kunlik plan uchun esa o'sha kun planiga "to'lov" (source: deposit/cashback)
// Shu tariqa qaysi qarz qaysi manbadan, qachon qoplangani aniq ko'rinadi (§9).

const ZERO = 0;
const sumOut = async (Model, match) => {
  const r = await Model.aggregate([{ $match: match }, { $group: { _id: null, s: { $sum: "$amount" } } }]);
  return r[0]?.s || ZERO;
};

const depositBalance = async (driverId) => {
  const inSum = await sumOut(DepositTransaction, { driver: driverId, type: DEPOSIT_TX_TYPE.IN });
  const outSum = await sumOut(DepositTransaction, { driver: driverId, type: DEPOSIT_TX_TYPE.OUT });
  return inSum - outSum;
};

// Jarima/zarar uchun qoplangan summa (depozit + keshbek coverage refi bo'yicha).
export const coverageByRef = async (driverId, kind) => {
  const map = new Map();
  const add = (rows) => {
    for (const r of rows) map.set(String(r._id), (map.get(String(r._id)) || 0) + r.s);
  };
  add(
    await DepositTransaction.aggregate([
      { $match: { driver: driverId, type: DEPOSIT_TX_TYPE.OUT, "coverage.kind": kind } },
      { $group: { _id: "$coverage.ref", s: { $sum: "$amount" } } },
    ]),
  );
  add(
    await CashbackTransaction.aggregate([
      { $match: { driver: driverId, type: CASHBACK_TX_TYPE.PAYOUT, "coverage.kind": kind } },
      { $group: { _id: "$coverage.ref", s: { $sum: "$amount" } } },
    ]),
  );
  return map;
};

const buildObligations = async (driverId) => {
  const plans = await DailyPlan.find({ driver: driverId, planAmount: { $gt: 0 } }).select("date planAmount");
  const paid = await paidByPlan(plans.map((p) => p._id));
  const out = [];
  for (const p of plans) {
    const remaining = p.planAmount - (paid.get(String(p._id)) || 0);
    if (remaining > 0) out.push({ kind: "daily", ref: p._id, date: p.date, outstanding: remaining });
  }
  const [fines, damages, finesCov, damagesCov] = await Promise.all([
    Fine.find({ driver: driverId }).select("issueDate amount"),
    Damage.find({ driver: driverId }).select("incidentDate amount"),
    coverageByRef(driverId, "fine"),
    coverageByRef(driverId, "damage"),
  ]);
  for (const f of fines) {
    const remaining = f.amount - (finesCov.get(String(f._id)) || 0);
    if (remaining > 0) out.push({ kind: "fine", ref: f._id, date: f.issueDate, outstanding: remaining });
  }
  for (const d of damages) {
    const remaining = d.amount - (damagesCov.get(String(d._id)) || 0);
    if (remaining > 0) out.push({ kind: "damage", ref: d._id, date: d.incidentDate, outstanding: remaining });
  }
  out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return out;
};

const LABEL = { daily: "Kunlik ijara qoplandi", fine: "Jarima qoplandi", damage: "Zarar qoplandi" };

export const settleDriver = async (driverId, userId = null) => {
  const firstWork = await workPeriods.firstStartDate(driverId);
  if (!firstWork) return;
  await ensureUpToToday(driverId, firstWork);

  let depositBal = await depositBalance(driverId);
  // Keshbek qoldig'i oylar bo'yicha (eng eskidan sarflanadi).
  const cb = await cashbackAccrual.monthsForDriver(driverId);
  const wallet = cb.months
    .map((m) => ({ monthStart: m.monthStart, available: m.monthlyAvailable }))
    .filter((m) => m.available > 0)
    .sort((a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime());
  let cbTotal = wallet.reduce((s, m) => s + m.available, 0);

  if (depositBal <= 0 && cbTotal <= 0) return;

  const obligations = await buildObligations(driverId);

  const coverDaily = async (ref, date, amount, source) => {
    await Transaction.create({
      dailyPlan: ref,
      driver: driverId,
      date,
      type: TX_TYPE.PAYMENT,
      source,
      amount,
      note: source === TX_SOURCE.DEPOSIT ? "Depozitdan qoplandi" : "Keshbekdan qoplandi",
      createdBy: userId,
    });
  };

  for (const ob of obligations) {
    let need = ob.outstanding;

    // 1) Depozit / balans
    if (need > 0 && depositBal > 0) {
      const c = Math.min(need, depositBal);
      await DepositTransaction.create({
        driver: driverId,
        type: DEPOSIT_TX_TYPE.OUT,
        amount: c,
        coverage: { kind: ob.kind, ref: ob.ref, date: ob.date },
        auto: true,
        note: LABEL[ob.kind],
        createdBy: userId,
      });
      if (ob.kind === "daily") await coverDaily(ob.ref, ob.date, c, TX_SOURCE.DEPOSIT);
      depositBal -= c;
      need -= c;
    }

    // 2) Keshbek (eng eski oydan)
    while (need > 0 && cbTotal > 0) {
      const m = wallet.find((x) => x.available > 0);
      if (!m) break;
      const c = Math.min(need, m.available);
      await CashbackTransaction.create({
        driver: driverId,
        monthStart: m.monthStart,
        type: CASHBACK_TX_TYPE.PAYOUT,
        amount: c,
        coverage: { kind: ob.kind, ref: ob.ref, date: ob.date },
        auto: true,
        note: LABEL[ob.kind],
        createdBy: userId,
      });
      if (ob.kind === "daily") await coverDaily(ob.ref, ob.date, c, TX_SOURCE.CASHBACK);
      m.available -= c;
      cbTotal -= c;
      need -= c;
    }

    if (depositBal <= 0 && cbTotal <= 0) break;
  }
};
