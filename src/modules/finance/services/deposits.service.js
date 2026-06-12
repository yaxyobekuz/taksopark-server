import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import * as account from "./account.service.js";

// Depozit balansi = haydovchining UMUMIY hisob qoldig'i (§10): qo'lda kirim/chiqim
// + kunlik to'lov ortig'i − kunlik kamomad − jarima/zarar. Hech qachon saqlanmaydi,
// har doim manbalardan DERIVED.

export const balanceForDriver = async (driverId) => account.availableForDriver(driverId);

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

export const detailForDriver = async (driverId) => {
  const [acc, ledger] = await Promise.all([
    account.computeForDriver(driverId),
    account.ledgerForDriver(driverId),
  ]);
  return { balance: acc.available, debt: acc.debt, account: acc, ledger };
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
    const available = await account.availableForDriver(driverId);
    if (value > available) {
      throw new ApiError(409, `Chiqim mavjud balansdan (${available}) oshmasligi kerak`);
    }
  }

  const created = await DepositTransaction.create({
    driver: driverId,
    type,
    amount: value,
    note: note || "",
    createdBy: currentUser._id,
  });

  // Konkurensiya himoyasi (§8 audit): chiqimdan keyin qoldiq manfiyga tushsa
  // (bir vaqtda ikki chiqim), yangi yozuvni qaytarib olamiz.
  if (type === DEPOSIT_TX_TYPE.OUT) {
    const acc = await account.computeForDriver(driverId);
    if (acc.net < 0) {
      await created.deleteOne();
      throw new ApiError(409, "Chiqim mavjud balansdan oshib ketdi, qayta urinib ko'ring");
    }
  }
  return { balance: await balanceForDriver(driverId) };
};

export const reverseMovement = async (transactionId, currentUser) => {
  const original = await DepositTransaction.findById(transactionId);
  if (!original) throw new ApiError(404, "Tranzaksiya topilmadi");
  if (original.reverses) {
    throw new ApiError(409, "Tuzatuvchi tranzaksiyani qayta tuzatib bo'lmaydi");
  }
  const already = await DepositTransaction.exists({ reverses: original._id });
  if (already) throw new ApiError(409, "Bu tranzaksiya allaqachon bekor qilingan");

  const opposite = original.type === DEPOSIT_TX_TYPE.IN ? DEPOSIT_TX_TYPE.OUT : DEPOSIT_TX_TYPE.IN;
  await DepositTransaction.create({
    driver: original.driver,
    type: opposite,
    amount: original.amount,
    reverses: original._id,
    note: "Tuzatish",
    createdBy: currentUser._id,
  });
  return { balance: await balanceForDriver(String(original.driver)) };
};
