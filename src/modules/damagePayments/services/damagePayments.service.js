import Damage from "../../../models/damage.model.js";
import DamagePayment from "../../../models/damagePayment.model.js";
import { PAYMENT_SOURCES } from "../../../models/finePayment.model.js";
import Transaction, { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../../../models/transaction.model.js";
import Driver from "../../../models/driver.model.js";
import Oylik from "../../../models/oylik.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS } from "../../../constants/tariffs.js";

const recomputeDamageStatus = (damage) => {
  if (damage.paidAmount <= 0) damage.paymentStatus = "pending";
  else if (damage.paidAmount >= damage.amount) damage.paymentStatus = "paid";
  else damage.paymentStatus = "partial";
};

export const listByDamage = async (damageId) => {
  const damage = await Damage.findById(damageId);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  const items = await DamagePayment.find({ damage: damageId }).sort({ paidAt: -1 });
  return { items, damage };
};

export const create = async (body, currentUser) => {
  const damage = await Damage.findById(body.damageId);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");

  const remaining = damage.amount - damage.paidAmount;
  if (body.amount > remaining) {
    throw new ApiError(400, "To'lov summasi qarz qoldig'idan oshib ketgan");
  }

  const driver = await Driver.findById(damage.driver);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  if (body.source === PAYMENT_SOURCES.DEPOSIT) {
    if (driver.tariff !== TARIFFS.DEPOSIT) {
      throw new ApiError(400, "Depozitdan to'lash faqat depozitli tarif uchun");
    }
    if (driver.depositRemaining < body.amount) {
      throw new ApiError(400, "Depozitda yetarli mablag' yo'q");
    }
    driver.depositRemaining -= body.amount;
    await driver.save();
  }

  const payment = await DamagePayment.create({
    damage: damage._id,
    amount: body.amount,
    source: body.source,
    paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
    note: body.note || "",
    createdBy: currentUser._id,
  });

  let txType, txSource;
  if (body.source === PAYMENT_SOURCES.DRIVER_CASH) {
    txType = TRANSACTION_TYPES.INCOME;
    txSource = TRANSACTION_SOURCES.DAMAGE_PAYMENT_CASH;
  } else if (body.source === PAYMENT_SOURCES.DEPOSIT) {
    txType = TRANSACTION_TYPES.INCOME;
    txSource = TRANSACTION_SOURCES.DAMAGE_PAYMENT_DEPOSIT;
  } else {
    txType = TRANSACTION_TYPES.EXPENSE;
    txSource = TRANSACTION_SOURCES.DAMAGE_SYSTEM;
  }

  await Transaction.create({
    type: txType,
    source: txSource,
    amount: body.amount,
    date: payment.paidAt,
    driver: damage.driver,
    damage: damage._id,
    damagePayment: payment._id,
    note: body.note || "",
    createdBy: currentUser._id,
  });

  if (body.source === PAYMENT_SOURCES.SYSTEM && damage.oylik) {
    await Oylik.updateOne({ _id: damage.oylik }, { $inc: { damagesTotal: body.amount } });
  }

  damage.paidAmount += body.amount;
  recomputeDamageStatus(damage);
  await damage.save();

  return payment;
};

export const remove = async (id) => {
  const payment = await DamagePayment.findById(id);
  if (!payment) throw new ApiError(404, "To'lov topilmadi");
  const damage = await Damage.findById(payment.damage);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");

  if (payment.source === PAYMENT_SOURCES.DEPOSIT) {
    const driver = await Driver.findById(damage.driver);
    if (driver && driver.tariff === TARIFFS.DEPOSIT) {
      driver.depositRemaining += payment.amount;
      await driver.save();
    }
  }

  if (payment.source === PAYMENT_SOURCES.SYSTEM && damage.oylik) {
    await Oylik.updateOne({ _id: damage.oylik }, { $inc: { damagesTotal: -payment.amount } });
  }

  await Transaction.deleteMany({ damagePayment: payment._id });
  await payment.deleteOne();

  damage.paidAmount = Math.max(0, damage.paidAmount - payment.amount);
  recomputeDamageStatus(damage);
  await damage.save();
};
