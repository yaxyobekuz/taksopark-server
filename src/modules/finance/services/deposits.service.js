import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import * as account from "./account.service.js";
import { settleDriver, releaseDailyCoverage } from "./settlement.service.js";

// Depozit balansi = SOF depozit qoldig'i = Σ(kirim) − Σ(chiqim). Bu haydovchining
// depozit hisobida haqiqatan yotgan pul - kunlik ijarani qoplaganda chiqim, ortiqcha
// to'lovda kirim bo'ladi. Hech qachon saqlanmaydi, manbadan DERIVED.
// (Eslatma: umumiy moliyaviy holat/qarz alohida - account.service'da; bu sahifa FAQAT
// depozitga aloqador ko'rsatkichlar bilan ishlaydi.)
export const balanceForDriver = async (driverId) => account.depositBalanceForDriver(driverId);

// Umumiy sahifa: depozitli davri bor barcha haydovchilar + balans/qarz.
export const summaryAll = async () => {
  const driverIds = await WorkPeriod.distinct("driver", { tariff: TARIFF.DEPOSIT });
  const drivers = await Driver.find({ _id: { $in: driverIds } }).select("firstName lastName phone");
  const rows = [];
  for (const d of drivers) {
    const acc = await account.computeForDriver(d._id);
    rows.push({ driver: d, balance: acc.available, debt: acc.debt });
  }
  rows.sort((a, b) => b.balance - a.balance);
  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  const totalDebt = rows.reduce((sum, r) => sum + r.debt, 0);
  return { rows, total, totalDebt };
};

export const transactionsForDriver = (driverId) =>
  DepositTransaction.find({ driver: driverId })
    .populate("createdBy", "fullName username")
    .sort({ createdAt: -1 });

const COVER_LABEL = {
  daily: "Kunlik ijara qoplandi",
  fine: "Jarima qoplandi",
  damage: "Zarar qoplandi",
};

// Depozit harakatlari (kirim/chiqim) + yugurib boruvchi depozit balansi. Avtomatik
// qoplash chiqimlari "Kunlik ijara/Jarima/Zarar qoplandi" deb belgilanadi.
export const depositLedger = async (driverId) => {
  const txs = await DepositTransaction.find({ driver: driverId }).sort({ createdAt: 1 });
  let running = 0;
  const entries = txs.map((t) => {
    const amount = t.type === DEPOSIT_TX_TYPE.IN ? t.amount : -t.amount;
    running += amount;
    const label = t.coverage
      ? COVER_LABEL[t.coverage.kind] || "Qoplash"
      : t.type === DEPOSIT_TX_TYPE.IN
        ? "Depozit kirim"
        : "Depozit chiqim";
    return {
      txId: String(t._id),
      date: t.coverage?.date || t.createdAt,
      label,
      note: t.note || "",
      amount,
      balance: running,
      // O'chirib bo'ladi: qo'lda kirim/chiqim + avtomatik KUNLIK qoplash (juftligi bilan
      // o'chadi). Jarima/zarar qoplashi bu yerda emas - tegishli jarima/zarardan boshqariladi.
      deletable: !(t.auto && t.coverage && t.coverage.kind !== "daily"),
    };
  });
  entries.reverse();
  return entries;
};

export const detailForDriver = async (driverId) => {
  // Ko'rishdan oldin mavjud depozit/keshbek bilan qarzlarni qoplaymiz (aniq tranzaksiyalar).
  await settleDriver(driverId);
  const [breakdown, ledger] = await Promise.all([
    account.depositBreakdownForDriver(driverId),
    depositLedger(driverId),
  ]);
  // FAQAT depozit: jami kirim, jami chiqim, sof balans (kirim−chiqim) + depozit harakatlari.
  // Umumiy hisob/qarz bu sahifaga aralashtirilmaydi (Kunlik to'lovlar / Hisobotlarda ko'rinadi).
  return { ...breakdown, ledger };
};

// Depozit harakati (kirim / chiqim). Chiqim umumiy hisob qoldig'idan oshmaydi.
export const createMovement = async (driverId, { type, amount, note }, currentUser) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (![DEPOSIT_TX_TYPE.IN, DEPOSIT_TX_TYPE.OUT].includes(type)) {
    throw new ApiError(400, "Harakat turi noto'g'ri");
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, "Summa musbat bo'lishi kerak");
  }

  if (type === DEPOSIT_TX_TYPE.OUT) {
    // Naqd yechish IKKI cheklov bilan: (1) DEPOZIT manbasida shuncha pul bo'lsin
    // (keshbek/balansdan "depozit chiqimi" yozib bo'lmaydi), (2) yechgach umumiy
    // hisob qarzga tushmasin. Bog'lovchi chegara = min(depozit qoldig'i, available).
    const [depositBal, available] = await Promise.all([
      account.depositBalanceForDriver(driverId),
      account.availableForDriver(driverId),
    ]);
    const cap = Math.min(depositBal, available);
    if (value > cap) {
      throw new ApiError(409, `Chiqim mavjud depozit qoldig'idan (${cap}) oshmasligi kerak`);
    }
  }

  const created = await DepositTransaction.create({
    driver: driverId,
    type,
    amount: value,
    note: note || "",
    createdBy: currentUser._id,
  });

  // Konkurensiya himoyasi (§8 audit): bir vaqtda ikki chiqim (yoki settlement) bilan
  // depozit manbasi YOKI umumiy hisob manfiyga tushsa - yangi yozuvni qaytarib olamiz.
  if (type === DEPOSIT_TX_TYPE.OUT) {
    const [depositBal, acc] = await Promise.all([
      account.depositBalanceForDriver(driverId),
      account.computeForDriver(driverId),
    ]);
    if (depositBal < 0 || acc.net < 0) {
      await created.deleteOne();
      throw new ApiError(409, "Chiqim mavjud balansdan oshib ketdi, qayta urinib ko'ring");
    }
  }

  // Kirim bo'lsa - yangi mablag' bilan qarzlarni avtomatik qoplaymiz (§10).
  if (type === DEPOSIT_TX_TYPE.IN) await settleDriver(driverId, currentUser._id);
  return { balance: await balanceForDriver(driverId) };
};

// Depozit harakatini BUTUNLAY o'chiradi (hard delete - "Tuzatish" yozuvi YO'Q).
// Balans Σ(kirim−chiqim) dan DERIVED, shuning uchun yozuv o'chgach o'z-o'zidan to'g'ri
// bo'ladi. Holatlar:
//   - Avtomatik KUNLIK qoplash chiqimi (auto OUT, coverage.kind=daily): juftligi (kunlik
//     plan to'lovi) bilan birga o'chiriladi, pul qaytadi (faqat autoSettleDaily o'chirilgan
//     bo'lsa - aks holda settlement darhol qayta qoplardi).
//   - Jarima/zarar qoplash chiqimi: bu yerda o'chirilmaydi (tegishli jarima/zararni tahrirlang).
//   - Qo'lda kirim/chiqim (yoki "Ortiqcha to'lov" kirim): to'g'ridan-to'g'ri o'chiriladi.
//     Kirim o'chsa depozit balansi manfiyga tushmasligi tekshiriladi (bu pul qoplashga
//     allaqachon ishlatilmagan bo'lsin).
export const deleteMovement = async (transactionId) => {
  const tx = await DepositTransaction.findById(transactionId);
  if (!tx) throw new ApiError(404, "Tranzaksiya topilmadi");
  const driverId = String(tx.driver);

  if (tx.auto && tx.coverage?.kind === "daily" && tx.type === DEPOSIT_TX_TYPE.OUT) {
    const driver = await Driver.findById(tx.driver).select("autoSettleDaily");
    if (driver?.autoSettleDaily !== false) {
      throw new ApiError(409, "Avval shu haydovchining kunlik avtomatik qoplashini o'chiring");
    }
    await releaseDailyCoverage(tx.coverage.ref);
    return { balance: await balanceForDriver(driverId) };
  }
  if (tx.auto && tx.coverage) {
    throw new ApiError(409, "Jarima/zarar qoplashini bu yerda o'chirib bo'lmaydi - tegishli jarima yoki zararni tahrirlang");
  }
  if (tx.type === DEPOSIT_TX_TYPE.IN) {
    const bal = await account.depositBalanceForDriver(tx.driver);
    if (bal - tx.amount < 0) {
      throw new ApiError(409, "Bu kirim allaqachon kunlik to'lov/qarz qoplashga ishlatilgan - avval o'sha qoplashlarni o'chiring");
    }
  }
  await tx.deleteOne();
  return { balance: await balanceForDriver(driverId) };
};
