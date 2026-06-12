import Transaction, { TX_TYPE } from "../../../models/transaction.model.js";
import DailyPlan from "../../../models/dailyPlan.model.js";
import ApiError from "../../../utils/ApiError.js";
import { paidByPlan, getPlanById } from "./dailyPlans.service.js";

// Plan uchun barcha tranzaksiyalar (audit izi - eskidan yangiga).
export const listByPlan = async (dailyPlanId) => {
  const plan = await DailyPlan.findById(dailyPlanId);
  if (!plan) throw new ApiError(404, "Kunlik plan topilmadi");
  return Transaction.find({ dailyPlan: dailyPlanId })
    .populate("createdBy", "fullName username")
    .sort({ createdAt: 1 });
};

export const listByDriver = async ({ driverId, fromDate, toDate, page = 1, limit = 20 }) => {
  const filter = { driver: driverId };
  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = fromDate;
    if (toDate) filter.date.$lte = toDate;
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);
  return { items, total };
};

// Kunlik to'lov (yoki bo'lakli to'lov) qo'shish. Haydovchi bir planda bo'lib-bo'lib
// to'lashi mumkin - har bo'lak ALOHIDA tranzaksiya (§9).
export const createPayment = async (dailyPlanId, { amount, note }, currentUser) => {
  const plan = await DailyPlan.findById(dailyPlanId);
  if (!plan) throw new ApiError(404, "Kunlik plan topilmadi");

  // Dam olish kunida majburiyat yo'q - to'lov kiritib bo'lmaydi.
  if (plan.isRestDay) {
    throw new ApiError(409, "Dam olish kunida to'lov kiritib bo'lmaydi");
  }
  if (plan.priceMissing) {
    throw new ApiError(409, "Bu kun uchun narx belgilanmagan, to'lov kiritib bo'lmaydi");
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, "To'lov summasi musbat bo'lishi kerak");
  }

  // Ortiqcha to'lov hozircha qo'llab-quvvatlanmaydi (depozit/balans keyingi bosqich) -
  // shuning uchun to'lov o'sha kun qoldig'idan oshmasligi kerak. Bo'lib-bo'lib to'lash
  // saqlanadi: bir necha marta, lekin jami planAmount'dan oshmaydi.
  const paidMap = await paidByPlan([plan._id]);
  const alreadyPaid = paidMap.get(String(plan._id)) || 0;
  const remaining = (plan.planAmount || 0) - alreadyPaid;
  if (remaining <= 0) {
    throw new ApiError(409, "Bu kun uchun to'lov to'liq amalga oshirilgan");
  }
  if (value > remaining) {
    throw new ApiError(409, `To'lov qoldiq qarzdan (${remaining}) oshmasligi kerak`);
  }

  await Transaction.create({
    dailyPlan: plan._id,
    driver: plan.driver,
    date: plan.date,
    type: TX_TYPE.PAYMENT,
    amount: value,
    note: note || "",
    createdBy: currentUser._id,
  });

  // Yangilangan plan (DERIVED to'langan/qarz bilan) qaytariladi.
  return getPlanById(plan._id);
};

// Tuzatuvchi (teskari) tranzaksiya. Xato to'lovni o'chirmaymiz - teskari yozuv
// qo'shamiz (append-only, audit izi saqlanadi - §9).
export const reverseTransaction = async (transactionId, { note }, currentUser) => {
  const original = await Transaction.findById(transactionId);
  if (!original) throw new ApiError(404, "Tranzaksiya topilmadi");
  if (original.type === TX_TYPE.REVERSAL) {
    throw new ApiError(409, "Tuzatuvchi tranzaksiyani qayta tuzatib bo'lmaydi");
  }

  // Allaqachon teskari qilinganini tekshiramiz (ikki marta bekor qilinmasin).
  const already = await Transaction.exists({ reverses: original._id });
  if (already) throw new ApiError(409, "Bu tranzaksiya allaqachon bekor qilingan");

  await Transaction.create({
    dailyPlan: original.dailyPlan,
    driver: original.driver,
    date: original.date,
    type: TX_TYPE.REVERSAL,
    amount: original.amount,
    reverses: original._id,
    note: note || "",
    createdBy: currentUser._id,
  });

  return getPlanById(original.dailyPlan);
};

export { paidByPlan };
