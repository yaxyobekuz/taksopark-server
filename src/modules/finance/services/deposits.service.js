import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";

// Balans = Σ(in) − Σ(out). Hech qachon saqlanmaydi — har doim DERIVED (§10).
export const balanceMap = async (driverIds) => {
  const map = new Map();
  if (!driverIds.length) return map;
  const rows = await DepositTransaction.aggregate([
    { $match: { driver: { $in: driverIds } } },
    {
      $group: {
        _id: "$driver",
        inSum: { $sum: { $cond: [{ $eq: ["$type", DEPOSIT_TX_TYPE.IN] }, "$amount", 0] } },
        outSum: { $sum: { $cond: [{ $eq: ["$type", DEPOSIT_TX_TYPE.OUT] }, "$amount", 0] } },
      },
    },
  ]);
  for (const r of rows) map.set(String(r._id), r.inSum - r.outSum);
  return map;
};

export const balanceForDriver = async (driverId) => {
  const map = await balanceMap([driverId]);
  return map.get(String(driverId)) || 0;
};

// Umumiy sahifa: depozitli davri bor barcha haydovchilar + balanslar.
export const summaryAll = async () => {
  const driverIds = await WorkPeriod.distinct("driver", { tariff: TARIFF.DEPOSIT });
  const [drivers, balances] = await Promise.all([
    Driver.find({ _id: { $in: driverIds } }).select("firstName lastName phone"),
    balanceMap(driverIds),
  ]);
  const rows = drivers
    .map((d) => ({ driver: d, balance: balances.get(String(d._id)) || 0 }))
    .sort((a, b) => b.balance - a.balance);
  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  return { rows, total };
};

export const transactionsForDriver = (driverId) =>
  DepositTransaction.find({ driver: driverId })
    .populate("createdBy", "fullName username")
    .sort({ createdAt: -1 });

// Depozit harakati (kirim / chiqim). Chiqim balansdan oshmaydi.
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
    const balance = await balanceForDriver(driverId);
    if (value > balance) {
      throw new ApiError(409, `Chiqim mavjud balansdan (${balance}) oshmasligi kerak`);
    }
  }
  await DepositTransaction.create({
    driver: driverId,
    type,
    amount: value,
    note: note || "",
    createdBy: currentUser._id,
  });
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

  // Teskari turdagi yozuv qo'shiladi (in <-> out), eski yozuv izga qoladi (§9).
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
