import DailyPlan from "../../../models/dailyPlan.model.js";
import Driver from "../../../models/driver.model.js";
import Transaction, { TX_TYPE, TX_SOURCE } from "../../../models/transaction.model.js";
import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import ApiError from "../../../utils/ApiError.js";
import { ensureUpToToday, paidByPlan } from "../../payments/services/dailyPlans.service.js";
import * as workPeriods from "../../workPeriods/services/workPeriods.service.js";
import * as cashbackAccrual from "./cashbackAccrual.service.js";
import { toObjectId } from "../../../utils/objectId.js";
import { withTransaction } from "../../../utils/withTransaction.js";

// §10 QOPLASH (settlement): haydovchining qoplanmagan majburiyatlarini (eng eskidan)
// mavjud DEPOZIT, so'ng KESHBEK bilan avtomatik yopadi. Har qoplash AYNIQ yoziladi:
//   - manbadan chiqim (depozit "out" / keshbek "payout") - coverage refi bilan
//   - kunlik plan uchun esa o'sha kun planiga "to'lov" (source: deposit/cashback)
// Shu tariqa qaysi qarz qaysi manbadan, qachon qoplangani aniq ko'rinadi (§9).

const ZERO = 0;
const sumOut = async (Model, match) => {
  const r = await Model.aggregate([{ $match: match }, { $group: { _id: null, s: { $sum: "$amount" } } }]);
  return r[0]?.s || ZERO;
};

const depositBalance = async (driverId) => {
  const did = toObjectId(driverId);
  const inSum = await sumOut(DepositTransaction, { driver: did, type: DEPOSIT_TX_TYPE.IN });
  const outSum = await sumOut(DepositTransaction, { driver: did, type: DEPOSIT_TX_TYPE.OUT });
  return inSum - outSum;
};

// Jarima/zarar uchun qoplangan summa (depozit + keshbek coverage refi bo'yicha).
export const coverageByRef = async (driverId, kind) => {
  const did = toObjectId(driverId);
  const map = new Map();
  const add = (rows) => {
    for (const r of rows) map.set(String(r._id), (map.get(String(r._id)) || 0) + r.s);
  };
  add(
    await DepositTransaction.aggregate([
      { $match: { driver: did, type: DEPOSIT_TX_TYPE.OUT, "coverage.kind": kind } },
      { $group: { _id: "$coverage.ref", s: { $sum: "$amount" } } },
    ]),
  );
  add(
    await CashbackTransaction.aggregate([
      { $match: { driver: did, type: CASHBACK_TX_TYPE.PAYOUT, "coverage.kind": kind } },
      { $group: { _id: "$coverage.ref", s: { $sum: "$amount" } } },
    ]),
  );
  return map;
};

// includeDaily=false bo'lsa KUNLIK majburiyatlar qoplash ro'yxatiga kirmaydi
// (haydovchining autoSettleDaily o'chirilgan) - jarima/zarar baribir qoplanadi.
const buildObligations = async (driverId, { includeDaily = true } = {}) => {
  const out = [];
  if (includeDaily) {
    const plans = await DailyPlan.find({ driver: driverId, planAmount: { $gt: 0 } }).select("date planAmount");
    const paid = await paidByPlan(plans.map((p) => p._id));
    for (const p of plans) {
      const remaining = p.planAmount - (paid.get(String(p._id)) || 0);
      if (remaining > 0) out.push({ kind: "daily", ref: p._id, date: p.date, outstanding: remaining });
    }
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

// Berilgan majburiyatga (kind + ref, masalan jarima/zarar) bog'langan AVTOMATIK
// qoplash chiqimlarini (depozit OUT, keshbek PAYOUT) teskari qaytaradi (§9 append-only).
// Har biriga qarama-qarshi turdagi yangi yozuv: depozit OUT → IN, keshbek PAYOUT →
// REVERSAL (ikkalasi ham reverses + auto bilan). IDEMPOTENT: allaqachon teskari
// qilingan (reverses bilan ko'rsatilgan) yozuv qayta qaytarilmaydi.
//
// MUHIM: teskari yozuvga coverage QO'YILMAYDI (null). Ikki sabab: (1) coverageByRef
// faqat OUT/PAYOUT ni yig'adi - teskari IN/REVERSAL undan o'z-o'zidan tushib, qoplangan
// summa avtomatik kamayadi; (2) ledger coverage bo'lsa "Jarima qoplandi" deb yorliqlaydi -
// teskari (kirim) yozuvda bu chalkash bo'lardi, shuning uchun "Qoplash bekor qilindi"
// note ishlatiladi. Audit izi `reverses` (asl chiqim id) orqali saqlanadi.
//
// Ishlatilishi: jarima/zarar summasi o'zgarsa yoki o'chsa - eski coverage to'liq
// qaytariladi, so'ng settleDriver yangi (kichraygan yoki nol) majburiyatni qaytadan qoplaydi.
export const reverseCoverageFor = (driverId, kind, ref, userId = null) =>
  withTransaction(async (session) => {
    const did = toObjectId(driverId);
    const refId = toObjectId(ref);

    // --- Depozit OUT coverage qatorlari ---
    const depOuts = await DepositTransaction.find({
      driver: did,
      type: DEPOSIT_TX_TYPE.OUT,
      "coverage.kind": kind,
      "coverage.ref": refId,
    }).session(session);
    if (depOuts.length) {
      const depReversed = new Set(
        (
          await DepositTransaction.find({ driver: did, reverses: { $ne: null } })
            .select("reverses")
            .session(session)
        ).map((d) => String(d.reverses)),
      );
      const depDocs = depOuts
        .filter((o) => !depReversed.has(String(o._id)))
        .map((o) => ({
          driver: did,
          type: DEPOSIT_TX_TYPE.IN,
          amount: o.amount,
          reverses: o._id,
          coverage: null,
          auto: true,
          note: "Qoplash bekor qilindi",
          createdBy: userId,
        }));
      if (depDocs.length) await DepositTransaction.create(depDocs, { session });
    }

    // --- Keshbek PAYOUT coverage qatorlari (monthStart saqlanadi) ---
    const cbOuts = await CashbackTransaction.find({
      driver: did,
      type: CASHBACK_TX_TYPE.PAYOUT,
      "coverage.kind": kind,
      "coverage.ref": refId,
    }).session(session);
    if (cbOuts.length) {
      const cbReversed = new Set(
        (
          await CashbackTransaction.find({ driver: did, reverses: { $ne: null } })
            .select("reverses")
            .session(session)
        ).map((c) => String(c.reverses)),
      );
      const cbDocs = cbOuts
        .filter((o) => !cbReversed.has(String(o._id)))
        .map((o) => ({
          driver: did,
          monthStart: o.monthStart,
          type: CASHBACK_TX_TYPE.REVERSAL,
          amount: o.amount,
          reverses: o._id,
          coverage: null,
          auto: true,
          note: "Qoplash bekor qilindi",
          createdBy: userId,
        }));
      if (cbDocs.length) await CashbackTransaction.create(cbDocs, { session });
    }
  });

const settleDriverImpl = async (driverId, userId = null) => {
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

  // Kunlik auto-qoplash o'chirilgan bo'lsa, kunlik majburiyatlar qoplanmaydi (loop'ni
  // uzadi: admin auto-qoplangan kunni o'chirgach, qaytgan pul kunlikni qayta qoplamaydi).
  const driver = await Driver.findById(driverId).select("autoSettleDaily");
  const includeDaily = driver?.autoSettleDaily !== false;

  const obligations = await buildObligations(driverId, { includeDaily });
  if (!obligations.length) return;

  // Manbadan chiqim + (kunlik bo'lsa) plan to'lovi ATOMAR yoziladi (§6): ikkalasi
  // birga yoki hech biri - pul yarim yo'lda qolmaydi.
  const coverFromDeposit = async (ob, c) =>
    withTransaction(async (session) => {
      await DepositTransaction.create(
        [
          {
            driver: driverId,
            type: DEPOSIT_TX_TYPE.OUT,
            amount: c,
            coverage: { kind: ob.kind, ref: ob.ref, date: ob.date },
            auto: true,
            note: LABEL[ob.kind],
            createdBy: userId,
          },
        ],
        { session },
      );
      if (ob.kind === "daily") {
        await Transaction.create(
          [
            {
              dailyPlan: ob.ref,
              driver: driverId,
              date: ob.date,
              type: TX_TYPE.PAYMENT,
              source: TX_SOURCE.DEPOSIT,
              amount: c,
              note: "Depozitdan qoplandi",
              createdBy: userId,
            },
          ],
          { session },
        );
      }
    });

  const coverFromCashback = async (ob, m, c) =>
    withTransaction(async (session) => {
      await CashbackTransaction.create(
        [
          {
            driver: driverId,
            monthStart: m.monthStart,
            type: CASHBACK_TX_TYPE.PAYOUT,
            amount: c,
            coverage: { kind: ob.kind, ref: ob.ref, date: ob.date },
            auto: true,
            note: LABEL[ob.kind],
            createdBy: userId,
          },
        ],
        { session },
      );
      if (ob.kind === "daily") {
        await Transaction.create(
          [
            {
              dailyPlan: ob.ref,
              driver: driverId,
              date: ob.date,
              type: TX_TYPE.PAYMENT,
              source: TX_SOURCE.CASHBACK,
              amount: c,
              note: "Keshbekdan qoplandi",
              createdBy: userId,
            },
          ],
          { session },
        );
      }
    });

  for (const ob of obligations) {
    let need = ob.outstanding;

    // 1) Depozit / balans
    if (need > 0 && depositBal > 0) {
      const c = Math.min(need, depositBal);
      await coverFromDeposit(ob, c);
      depositBal -= c;
      need -= c;
    }

    // 2) Keshbek (eng eski oydan)
    while (need > 0 && cbTotal > 0) {
      const m = wallet.find((x) => x.available > 0);
      if (!m) break;
      const c = Math.min(need, m.available);
      await coverFromCashback(ob, m, c);
      m.available -= c;
      cbTotal -= c;
      need -= c;
    }

    if (depositBal <= 0 && cbTotal <= 0) break;
  }
};

// Bitta kunlik plan uchun AVTOMATIK qoplashni butunlay olib tashlaydi (admin shu kunni
// "bo'shatib", ish/narx/biriktirish davrini tahrirlashi uchun). Auto-qoplash DERIVED
// (§11A) - manba o'zgarsa qayta hisoblanadigan yozuv, shuning uchun teskari reversal
// emas, to'g'ridan-to'g'ri OLIB TASHLANADI; pul depozit/keshbekka qaytadi (balanslar
// summadan derived - chiqim yozuvi o'chgani uchun avtomatik tiklanadi).
//   - kunlik planga bog'langan "to'lov" yozuvi (source: deposit/cashback)
//   - shu planni qoplagan depozit OUT / keshbek PAYOUT auto chiqimlari (coverage.ref)
// MUHIM: bu faqat haydovchining autoSettleDaily O'CHIRILGAN holatida ma'noli - aks
// holda keyingi settleDriver darhol qayta qoplab qo'yadi (chaqiruvchi servis tekshiradi).
export const releaseDailyCoverage = (planId) =>
  withTransaction(async (session) => {
    const pid = toObjectId(planId);
    const plan = await DailyPlan.findById(pid).select("driver").session(session);
    if (!plan) throw new ApiError(404, "Kunlik plan topilmadi");
    const did = plan.driver;

    await Transaction.deleteMany({
      dailyPlan: pid,
      source: { $in: [TX_SOURCE.DEPOSIT, TX_SOURCE.CASHBACK] },
    }).session(session);
    await DepositTransaction.deleteMany({
      driver: did,
      type: DEPOSIT_TX_TYPE.OUT,
      auto: true,
      "coverage.kind": "daily",
      "coverage.ref": pid,
    }).session(session);
    await CashbackTransaction.deleteMany({
      driver: did,
      type: CASHBACK_TX_TYPE.PAYOUT,
      auto: true,
      "coverage.kind": "daily",
      "coverage.ref": pid,
    }).session(session);
    return did;
  });

// Concurrency himoyasi: settleDriver ko'p joydan (depozit kirim, sahifa o'qish,
// kunlik job) bir vaqtda chaqiriladi. Himoyasiz bo'lsa parallel ishlashlar bir xil
// qarzni qayta qoplab DUBLIKAT (yoki yarim) qoplash yaratadi - depozit ledger buziladi.
// Shu sababli HAR HAYDOVCHI uchun ketma-ket (per-driver mutex) ishlatamiz: parallel
// chaqiruvlar navbatga turadi, birinchisi hammasini qoplaydi, qolganlari idempotent
// no-op bo'ladi. (Bitta Node jarayoni - Agenda ham shu jarayonda, demak in-process
// lock yetarli; bir necha jarayonga o'tilsa, DB-asosli lock kerak bo'ladi.)
const settleLocks = new Map();

export const settleDriver = (driverId, userId = null) => {
  const key = String(driverId);
  const prev = settleLocks.get(key) || Promise.resolve();
  // Oldingisi xato bilan tugasa ham navbat to'xtamaydi.
  const next = prev.then(
    () => settleDriverImpl(driverId, userId),
    () => settleDriverImpl(driverId, userId),
  );
  const tail = next.catch(() => {}); // navbat quyrug'i hech qachon reject bo'lmaydi
  settleLocks.set(key, tail);
  tail.then(() => {
    if (settleLocks.get(key) === tail) settleLocks.delete(key);
  });
  return next; // chaqiruvchi haqiqiy natija/xatoni oladi
};
