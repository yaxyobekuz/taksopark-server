import CashbackTransaction, { CASHBACK_TX_TYPE } from "../../../models/cashbackTransaction.model.js";
import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { monthsForDriver } from "./cashbackAccrual.service.js";
import { settleDriver, releaseDailyCoverage } from "./settlement.service.js";

const sod = (d) => startOfDayTashkent(d);

export { monthsForDriver };

// Umumiy sahifa: keshbek davri bor barcha haydovchilar + jami.
// "available" = SOF keshbek qoldig'i = Σ(hisoblangan − berilgan), oyma-oy. Keshbek
// haydovchining ishlab topgan puli - umumiy hisob qarzidan QAT'I NAZAR yechib olinadi
// (egasi qarori 2026-06-24). Hisob qarzi bu yerga ARALASHTIRILMAYDI.
export const summaryAll = async () => {
  const driverIds = await WorkPeriod.distinct("driver", { tariff: TARIFF.CASHBACK });
  const rows = [];
  for (const id of driverIds) {
    const { driver, totals } = await monthsForDriver(id);
    rows.push({
      driver,
      accrued: totals.accrued,
      paidOut: totals.paidOut,
      available: totals.monthlyAvailable,
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

// Bitta haydovchining keshbek oylari + SOF berilishi kerak (hisoblangan − berilgan).
export const detailForDriver = async (driverId) => {
  await settleDriver(driverId);
  const [data, ledger] = await Promise.all([
    monthsForDriver(driverId),
    cashbackLedger(driverId),
  ]);
  // FAQAT keshbek: har oy "available" = sof oylik qoldiq (monthlyAvailable), jami
  // "available" = sof berilishi kerak. Hisob qarzi ARALASHTIRILMAYDI - keshbek
  // haydovchining puli, qarzdan qat'i nazar to'liq yechib olinadi (egasi qarori).
  const months = data.months.map((m) => ({ ...m, available: m.monthlyAvailable }));
  return {
    driver: data.driver,
    months,
    totals: {
      accrued: data.totals.accrued,
      paidOut: data.totals.paidOut,
      available: data.totals.monthlyAvailable,
    },
    ledger,
  };
};

export const transactionsForDriver = (driverId) =>
  CashbackTransaction.find({ driver: driverId })
    .populate("createdBy", "fullName username")
    .sort({ createdAt: -1 });

const CB_COVER_LABEL = {
  daily: "Kunlik ijara qoplandi",
  fine: "Jarima qoplandi",
  damage: "Zarar qoplandi",
};

// Keshbek harakatlari: hisoblangan (oylik +), berilgan/qoplangan (−), yugurib boruvchi qoldiq.
export const cashbackLedger = async (driverId) => {
  const [cb, txs] = await Promise.all([
    monthsForDriver(driverId),
    CashbackTransaction.find({ driver: driverId }).sort({ createdAt: 1 }),
  ]);
  const entries = [];
  for (const m of cb.months) {
    if (m.accrued > 0)
      entries.push({ date: m.accrualDate, label: "Keshbek hisoblandi", note: "", amount: m.accrued });
  }
  for (const t of txs) {
    const isReversal = t.type === CASHBACK_TX_TYPE.REVERSAL;
    const amount = isReversal ? t.amount : -t.amount;
    const label = isReversal
      ? "Keshbek bekor qilindi"
      : t.coverage
        ? CB_COVER_LABEL[t.coverage.kind] || "Qoplandi"
        : "Keshbek berildi";
    entries.push({
      txId: String(t._id),
      date: t.coverage?.date || t.createdAt,
      label,
      note: t.note || "",
      amount,
      // O'chirib bo'ladi: qo'lda berilgan keshbek + avtomatik KUNLIK qoplash (juftligi
      // bilan o'chadi). Jarima/zarar qoplashi bu yerda emas (tegishli jarima/zardan).
      deletable: !(t.auto && t.coverage && t.coverage.kind !== "daily"),
    });
  }
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;
  for (const e of entries) {
    running += e.amount;
    e.balance = running;
  }
  entries.reverse();
  return entries;
};

// Keshbek payout (yechib olish). Faqat o'sha oyning SOF keshbek qoldig'idan oshmaydi -
// umumiy hisob qarzi cheklamaydi (keshbek = haydovchining puli, egasi qarori 2026-06-24).
export const createPayout = async (driverId, { monthStart, amount, note }, currentUser) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, "Summa musbat bo'lishi kerak");
  }
  const target = sod(monthStart);
  const { months } = await monthsForDriver(driverId);
  const month = months.find((m) => m.monthStart.getTime() === target.getTime());
  if (!month) throw new ApiError(404, "Keshbek oyi topilmadi");

  const cap = month.monthlyAvailable;
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

// Keshbek tranzaksiyasini BUTUNLAY o'chiradi (hard delete - "Tuzatish" yozuvi YO'Q).
// Berilgan/qoldiq keshbek tranzaksiyalardan DERIVED - yozuv o'chgach o'z-o'zidan
// to'g'ri bo'ladi. Holatlar:
//   - Avtomatik KUNLIK qoplash (auto PAYOUT, coverage.kind=daily): juftligi (kunlik plan
//     to'lovi) bilan birga o'chiriladi, keshbek qoldig'i qaytadi (faqat autoSettleDaily
//     o'chirilgan bo'lsa).
//   - Jarima/zarar qoplash payout'i: bu yerda o'chirilmaydi (tegishli jarima/zararni tahrirlang).
//   - Qo'lda berilgan keshbek (payout): to'g'ridan-to'g'ri o'chiriladi (qoldiq ortadi - xavfsiz).
export const deletePayout = async (transactionId) => {
  const tx = await CashbackTransaction.findById(transactionId);
  if (!tx) throw new ApiError(404, "Tranzaksiya topilmadi");
  const driverId = String(tx.driver);

  if (tx.auto && tx.coverage?.kind === "daily" && tx.type === CASHBACK_TX_TYPE.PAYOUT) {
    const driver = await Driver.findById(tx.driver).select("autoSettleDaily");
    if (driver?.autoSettleDaily !== false) {
      throw new ApiError(409, "Avval shu haydovchining kunlik avtomatik qoplashini o'chiring");
    }
    await releaseDailyCoverage(tx.coverage.ref);
    return detailForDriver(driverId);
  }
  if (tx.auto && tx.coverage) {
    throw new ApiError(409, "Jarima/zarar qoplashini bu yerda o'chirib bo'lmaydi - tegishli jarima yoki zararni tahrirlang");
  }
  await tx.deleteOne();
  return detailForDriver(driverId);
};
