import Fine from "../../../models/fine.model.js";
import FinePayment, { PAYMENT_SOURCES } from "../../../models/finePayment.model.js";
import Transaction, {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_SOURCES,
  TRANSACTION_WALLETS,
} from "../../../models/transaction.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS } from "../../../constants/tariffs.js";
import { writeLinkedTxs } from "../../../helpers/walletTransaction.helper.js";

const recomputeFineStatus = (fine) => {
  if (fine.paidAmount <= 0) fine.paymentStatus = "pending";
  else if (fine.paidAmount >= fine.amount) fine.paymentStatus = "paid";
  else fine.paymentStatus = "partial";
};

export const listByFine = async (fineId) => {
  const fine = await Fine.findById(fineId);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  const items = await FinePayment.find({ fine: fineId }).sort({ paidAt: -1 });
  return { items, fine };
};

export const create = async (body, currentUser) => {
  const fine = await Fine.findById(body.fineId);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");

  const remaining = fine.amount - fine.paidAmount;
  if (body.amount > remaining) {
    throw new ApiError(400, "To'lov summasi qarz qoldig'idan oshib ketgan");
  }

  const driver = await Driver.findById(fine.driver);
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

  const payment = await FinePayment.create({
    fine: fine._id,
    amount: body.amount,
    source: body.source,
    paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
    note: body.note || "",
    createdBy: currentUser._id,
  });

  // Naqd to'lov yoki manual depozit ushlash — qarz qopladi va tashqi hamyon balanslandi.
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
      driver: fine.driver,
      fine: fine._id,
      finePayment: payment._id,
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
      driver: fine.driver,
      fine: fine._id,
      finePayment: payment._id,
      note: body.note || "",
      createdBy: currentUser._id,
    },
  ];
  await writeLinkedTxs(txEntries);

  if (!isDeposit) {
    driver.totalDebt = Math.max(0, driver.totalDebt - body.amount);
    await driver.save();
  }

  fine.paidAmount += body.amount;
  recomputeFineStatus(fine);
  await fine.save();

  return payment;
};

export const remove = async (id) => {
  const payment = await FinePayment.findById(id);
  if (!payment) throw new ApiError(404, "To'lov topilmadi");
  const fine = await Fine.findById(payment.fine);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");

  if (payment.source === PAYMENT_SOURCES.DEPOSIT) {
    const driver = await Driver.findById(fine.driver);
    if (driver && driver.tariff === TARIFFS.DEPOSIT) {
      driver.depositRemaining += payment.amount;
      await driver.save();
    }
  }

  await Transaction.deleteMany({ finePayment: payment._id });
  await payment.deleteOne();

  fine.paidAmount = Math.max(0, fine.paidAmount - payment.amount);
  recomputeFineStatus(fine);
  await fine.save();
};
