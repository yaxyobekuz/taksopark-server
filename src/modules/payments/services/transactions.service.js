import Transaction, { TX_TYPE, TX_SOURCE } from "../../../models/transaction.model.js";
import DailyPlan from "../../../models/dailyPlan.model.js";
import Driver from "../../../models/driver.model.js";
import DepositTransaction, { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import { paidByPlan, getPlanById } from "./dailyPlans.service.js";
import { settleDriver, releaseDailyCoverage } from "../../finance/services/settlement.service.js";

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

  // Haydovchi naqd to'lovi avval o'sha kun qoldig'iga yoziladi; oshgan qism (ortiqcha
  // to'lov) haydovchi hisobiga (depozit/balans) KIRIM bo'ladi (§10).
  const paid = await paidByPlan([plan._id]);
  const remaining = Math.max(0, (plan.planAmount || 0) - (paid.get(String(plan._id)) || 0));
  const toPlan = Math.min(value, remaining);
  const excess = value - toPlan;

  if (toPlan > 0) {
    await Transaction.create({
      dailyPlan: plan._id,
      driver: plan.driver,
      date: plan.date,
      type: TX_TYPE.PAYMENT,
      source: TX_SOURCE.DRIVER,
      amount: toPlan,
      note: note || "",
      createdBy: currentUser._id,
    });
  }
  if (excess > 0) {
    await DepositTransaction.create({
      driver: plan.driver,
      type: DEPOSIT_TX_TYPE.IN,
      amount: excess,
      note: "Ortiqcha to'lov",
      createdBy: currentUser._id,
    });
  }

  // Yangi mablag' bo'lsa, boshqa qarzlarni qoplash uchun settlement.
  await settleDriver(plan.driver, currentUser._id);
  return getPlanById(plan._id);
};

// Tranzaksiyani BUTUNLAY o'chiradi (hard delete - reversal/tuzatish yozuvi YO'Q).
// To'langan/qarz tranzaksiyalardan DERIVED, shuning uchun o'chirilgach o'z-o'zidan
// to'g'ri qayta hisoblanadi. Ikki holat:
//   - Avtomatik qoplash (source: deposit/cashback) - juftligi (manba chiqimi) bilan
//     birga o'chiriladi va pul manbaga qaytadi (releaseAutoCoverage; faqat autoSettleDaily
//     O'CHIRILGAN bo'lsa - aks holda darhol qayta qoplanardi).
//   - Qo'lda kiritilgan to'lov (source: driver) - to'g'ridan-to'g'ri o'chiriladi.
export const deleteTransaction = async (transactionId) => {
  const tx = await Transaction.findById(transactionId);
  if (!tx) throw new ApiError(404, "Tranzaksiya topilmadi");
  const planId = tx.dailyPlan;
  if (tx.source === TX_SOURCE.DEPOSIT || tx.source === TX_SOURCE.CASHBACK) {
    return releaseAutoCoverage(planId);
  }
  await tx.deleteOne();
  return getPlanById(planId);
};

// Kunlik plandagi AVTOMATIK (depozit/keshbek) qoplashni o'chiradi - pul manbaga
// qaytadi, plan "tranzaksiyasiz" bo'lib qoladi va ish/narx/biriktirish davrini
// tahrirlash mumkin bo'ladi (referensial qulf bo'shaydi). Faqat haydovchining kunlik
// auto-qoplashi O'CHIRILGAN bo'lsa ruxsat - aks holda settlement darhol qayta qoplaydi.
export const releaseAutoCoverage = async (dailyPlanId) => {
  const plan = await DailyPlan.findById(dailyPlanId).select("driver");
  if (!plan) throw new ApiError(404, "Kunlik plan topilmadi");
  const driver = await Driver.findById(plan.driver).select("autoSettleDaily");
  if (driver?.autoSettleDaily !== false) {
    throw new ApiError(
      409,
      "Avval shu haydovchining kunlik avtomatik qoplashini o'chiring",
    );
  }
  await releaseDailyCoverage(plan._id);
  return getPlanById(plan._id);
};

export { paidByPlan };
