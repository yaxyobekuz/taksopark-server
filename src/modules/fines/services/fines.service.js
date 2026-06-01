import Fine from "../../../models/fine.model.js";
import FinePayment from "../../../models/finePayment.model.js";
import Transaction, {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_SOURCES,
  TRANSACTION_WALLETS,
} from "../../../models/transaction.model.js";
import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS } from "../../../constants/tariffs.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";
import { oylikForDate } from "../../oyliklar/services/oyliklar.service.js";
import { applyDepositDelta, collectFromOylik } from "../../../helpers/driverFinance.helper.js";
import { writeLinkedTxs } from "../../../helpers/walletTransaction.helper.js";

const recomputeFineStatus = (fine) => {
  if (fine.paidAmount <= 0) fine.paymentStatus = "pending";
  else if (fine.paidAmount >= fine.amount) fine.paymentStatus = "paid";
  else fine.paymentStatus = "partial";
};

export const list = async ({ driverId, carId, fromDate, toDate, paymentStatus, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (carId) filter.car = carId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (fromDate || toDate) {
    filter.issueDate = {};
    if (fromDate) filter.issueDate.$gte = startOfDayTashkent(fromDate);
    if (toDate) filter.issueDate.$lte = startOfDayTashkent(toDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Fine.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model notes")
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limit),
    Fine.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const fine = await Fine.findById(id)
    .populate("driver", "firstName lastName phone tariff")
    .populate("car", "plateNumber model notes");
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  return fine;
};

export const create = async (body, attachments, currentUser) => {
  if (!attachments || attachments.length === 0) {
    throw new ApiError(400, "Jarima uchun rasm yoki hujjat majburiy");
  }
  const driver = await Driver.findById(body.driverId).populate(
    "car",
    "dailyPaymentDeposit dailyPaymentNoDeposit monthlyCashback",
  );
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.status === DRIVER_STATUS.ARCHIVED) {
    throw new ApiError(409, "Haydovchi arxivlangan");
  }
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const issueDate = startOfDayTashkent(body.issueDate);
  const phase = getActiveTariffPhase(driver, driver.car, issueDate);

  // Sinov paytida oylikga bog'lanmaydi. Salary fazada jarima sanasidagi oylikga link.
  let oylikId = null;
  if (driver.tariff === TARIFFS.NO_DEPOSIT && phase.phase === "salary") {
    const oylik = await oylikForDate(driver._id, issueDate);
    if (oylik) oylikId = oylik._id;
  }

  const fine = await Fine.create({
    driver: driver._id,
    car: driver.car,
    amount: body.amount,
    issueDate,
    oylik: oylikId,
    attachments,
    paidAmount: body.amount,
    paymentStatus: "paid",
    createdBy: currentUser._id,
    note: body.note || "",
  });

  const txEntries = [
    {
      wallet: TRANSACTION_WALLETS.EXTERNAL,
      direction: TRANSACTION_DIRECTIONS.OUT,
      source: TRANSACTION_SOURCES.FINE_ISSUED,
      amount: fine.amount,
      date: fine.issueDate,
      driver: fine.driver,
      fine: fine._id,
      note: body.note || "",
      createdBy: currentUser._id,
    },
  ];

  if (driver.tariff === TARIFFS.DEPOSIT) {
    const prevDeposit = driver.depositRemaining;
    await applyDepositDelta(driver, -fine.amount);
    const deductedFromDeposit = prevDeposit - driver.depositRemaining;
    if (deductedFromDeposit > 0) {
      txEntries.push(
        {
          wallet: TRANSACTION_WALLETS.DEPOSIT,
          direction: TRANSACTION_DIRECTIONS.OUT,
          source: TRANSACTION_SOURCES.FINE_DEPOSIT_DEDUCT,
          amount: deductedFromDeposit,
          date: fine.issueDate,
          driver: fine.driver,
          fine: fine._id,
          createdBy: currentUser._id,
        },
        {
          wallet: TRANSACTION_WALLETS.EXTERNAL,
          direction: TRANSACTION_DIRECTIONS.IN,
          source: TRANSACTION_SOURCES.FINE_DEPOSIT_DEDUCT,
          amount: deductedFromDeposit,
          date: fine.issueDate,
          driver: fine.driver,
          fine: fine._id,
          createdBy: currentUser._id,
        },
      );
    }
    const newDebt = fine.amount - deductedFromDeposit;
    if (newDebt > 0) {
      txEntries.push({
        wallet: TRANSACTION_WALLETS.DEBT,
        direction: TRANSACTION_DIRECTIONS.IN,
        source: TRANSACTION_SOURCES.FINE_DEBT_RECORD,
        amount: newDebt,
        date: fine.issueDate,
        driver: fine.driver,
        fine: fine._id,
        createdBy: currentUser._id,
      });
    }
  } else {
    let remaining = fine.amount;
    if (phase.phase === "salary" && oylikId) {
      const collected = await collectFromOylik(remaining, "fine", oylikId);
      if (collected > 0) {
        txEntries.push(
          {
            wallet: TRANSACTION_WALLETS.EXTERNAL,
            direction: TRANSACTION_DIRECTIONS.IN,
            source: TRANSACTION_SOURCES.FINE_OYLIK_DEDUCT,
            amount: collected,
            date: fine.issueDate,
            driver: fine.driver,
            fine: fine._id,
            oylik: oylikId,
            createdBy: currentUser._id,
          },
        );
      }
      remaining -= collected;
    }
    if (remaining > 0) {
      driver.totalDebt += remaining;
      await driver.save();
      txEntries.push({
        wallet: TRANSACTION_WALLETS.DEBT,
        direction: TRANSACTION_DIRECTIONS.IN,
        source: TRANSACTION_SOURCES.FINE_DEBT_RECORD,
        amount: remaining,
        date: fine.issueDate,
        driver: fine.driver,
        fine: fine._id,
        createdBy: currentUser._id,
      });
    }
  }

  await writeLinkedTxs(txEntries);

  return fine;
};

export const update = async (id, body) => {
  const fine = await Fine.findById(id);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  if (body.note !== undefined) fine.note = body.note;
  if (body.amount !== undefined && body.amount !== fine.amount) {
    if (fine.paidAmount > body.amount) {
      throw new ApiError(409, "Yangi summa to'langan miqdordan kichik bo'lolmaydi");
    }
    fine.amount = body.amount;
    recomputeFineStatus(fine);
  }
  await fine.save();
  return fine;
};

export const remove = async (id) => {
  const fine = await Fine.findById(id);
  if (!fine) throw new ApiError(404, "Jarima topilmadi");
  if (fine.paidAmount > 0) {
    throw new ApiError(409, "Avval to'lovlarni bekor qiling");
  }
  await FinePayment.deleteMany({ fine: fine._id });
  await Transaction.deleteMany({ fine: fine._id });
  await fine.deleteOne();
};
