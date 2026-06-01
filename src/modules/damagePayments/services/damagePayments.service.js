import Damage from "../../../models/damage.model.js";
import DamagePayment from "../../../models/damagePayment.model.js";
import { PAYMENT_SOURCES } from "../../../models/finePayment.model.js";
import Transaction, {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_SOURCES,
  TRANSACTION_WALLETS,
} from "../../../models/transaction.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS } from "../../../constants/tariffs.js";
import { writeLinkedTxs } from "../../../helpers/walletTransaction.helper.js";

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

  const isDeposit = body.source === PAYMENT_SOURCES.DEPOSIT;
  const txEntries = [
    {
      wallet: isDeposit ? TRANSACTION_WALLETS.DEPOSIT : TRANSACTION_WALLETS.DEBT,
      direction: TRANSACTION_DIRECTIONS.OUT,
      source: isDeposit
        ? TRANSACTION_SOURCES.DEBT_REPAY_DEPOSIT
        : TRANSACTION_SOURCES.DEBT_REPAY_CASH,
      amount: body.amount,
      date: payment.paidAt,
      driver: damage.driver,
      damage: damage._id,
      damagePayment: payment._id,
      note: body.note || "",
      createdBy: currentUser._id,
    },
    {
      wallet: TRANSACTION_WALLETS.EXTERNAL,
      direction: TRANSACTION_DIRECTIONS.IN,
      source: isDeposit
        ? TRANSACTION_SOURCES.DEBT_REPAY_DEPOSIT
        : TRANSACTION_SOURCES.DEBT_REPAY_CASH,
      amount: body.amount,
      date: payment.paidAt,
      driver: damage.driver,
      damage: damage._id,
      damagePayment: payment._id,
      note: body.note || "",
      createdBy: currentUser._id,
    },
  ];
  await writeLinkedTxs(txEntries);

  if (!isDeposit) {
    driver.totalDebt = Math.max(0, driver.totalDebt - body.amount);
    await driver.save();
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

  await Transaction.deleteMany({ damagePayment: payment._id });
  await payment.deleteOne();

  damage.paidAmount = Math.max(0, damage.paidAmount - payment.amount);
  recomputeDamageStatus(damage);
  await damage.save();
};
