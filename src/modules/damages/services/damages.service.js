import Damage from "../../../models/damage.model.js";
import DamagePayment from "../../../models/damagePayment.model.js";
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

const recomputeDamageStatus = (damage) => {
  if (damage.paidAmount <= 0) damage.paymentStatus = "pending";
  else if (damage.paidAmount >= damage.amount) damage.paymentStatus = "paid";
  else damage.paymentStatus = "partial";
};

export const list = async ({ driverId, carId, fromDate, toDate, paymentStatus, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (carId) filter.car = carId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (fromDate || toDate) {
    filter.incidentDate = {};
    if (fromDate) filter.incidentDate.$gte = startOfDayTashkent(fromDate);
    if (toDate) filter.incidentDate.$lte = startOfDayTashkent(toDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Damage.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model notes")
      .sort({ incidentDate: -1 })
      .skip(skip)
      .limit(limit),
    Damage.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const damage = await Damage.findById(id)
    .populate("driver", "firstName lastName phone tariff")
    .populate("car", "plateNumber model notes");
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  return damage;
};

export const create = async (body, attachments, currentUser) => {
  if (!attachments || attachments.length === 0) {
    throw new ApiError(400, "Zarar uchun rasm yoki hujjat majburiy");
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

  const incidentDate = startOfDayTashkent(body.incidentDate);
  const phase = getActiveTariffPhase(driver, driver.car, incidentDate);

  // Sinov paytida oylikga bog'lanmaydi. Salary fazada zarar sanasidagi oylikga link.
  let oylikId = null;
  if (driver.tariff === TARIFFS.NO_DEPOSIT && phase.phase === "salary") {
    const oylik = await oylikForDate(driver._id, incidentDate);
    if (oylik) oylikId = oylik._id;
  }

  const damage = await Damage.create({
    driver: driver._id,
    car: driver.car,
    amount: body.amount,
    incidentDate,
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
      source: TRANSACTION_SOURCES.DAMAGE_ISSUED,
      amount: damage.amount,
      date: damage.incidentDate,
      driver: damage.driver,
      damage: damage._id,
      note: body.note || "",
      createdBy: currentUser._id,
    },
  ];

  if (driver.tariff === TARIFFS.DEPOSIT) {
    const prevDeposit = driver.depositRemaining;
    await applyDepositDelta(driver, -damage.amount);
    const deductedFromDeposit = prevDeposit - driver.depositRemaining;
    if (deductedFromDeposit > 0) {
      txEntries.push(
        {
          wallet: TRANSACTION_WALLETS.DEPOSIT,
          direction: TRANSACTION_DIRECTIONS.OUT,
          source: TRANSACTION_SOURCES.DAMAGE_DEPOSIT_DEDUCT,
          amount: deductedFromDeposit,
          date: damage.incidentDate,
          driver: damage.driver,
          damage: damage._id,
          createdBy: currentUser._id,
        },
        {
          wallet: TRANSACTION_WALLETS.EXTERNAL,
          direction: TRANSACTION_DIRECTIONS.IN,
          source: TRANSACTION_SOURCES.DAMAGE_DEPOSIT_DEDUCT,
          amount: deductedFromDeposit,
          date: damage.incidentDate,
          driver: damage.driver,
          damage: damage._id,
          createdBy: currentUser._id,
        },
      );
    }
    const newDebt = damage.amount - deductedFromDeposit;
    if (newDebt > 0) {
      txEntries.push({
        wallet: TRANSACTION_WALLETS.DEBT,
        direction: TRANSACTION_DIRECTIONS.IN,
        source: TRANSACTION_SOURCES.DAMAGE_DEBT_RECORD,
        amount: newDebt,
        date: damage.incidentDate,
        driver: damage.driver,
        damage: damage._id,
        createdBy: currentUser._id,
      });
    }
  } else {
    let remaining = damage.amount;
    if (phase.phase === "salary" && oylikId) {
      const collected = await collectFromOylik(remaining, "damage", oylikId);
      if (collected > 0) {
        txEntries.push({
          wallet: TRANSACTION_WALLETS.EXTERNAL,
          direction: TRANSACTION_DIRECTIONS.IN,
          source: TRANSACTION_SOURCES.DAMAGE_OYLIK_DEDUCT,
          amount: collected,
          date: damage.incidentDate,
          driver: damage.driver,
          damage: damage._id,
          oylik: oylikId,
          createdBy: currentUser._id,
        });
      }
      remaining -= collected;
    }
    if (remaining > 0) {
      driver.totalDebt += remaining;
      await driver.save();
      txEntries.push({
        wallet: TRANSACTION_WALLETS.DEBT,
        direction: TRANSACTION_DIRECTIONS.IN,
        source: TRANSACTION_SOURCES.DAMAGE_DEBT_RECORD,
        amount: remaining,
        date: damage.incidentDate,
        driver: damage.driver,
        damage: damage._id,
        createdBy: currentUser._id,
      });
    }
  }

  await writeLinkedTxs(txEntries);

  return damage;
};

export const update = async (id, body) => {
  const damage = await Damage.findById(id);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  if (body.note !== undefined) damage.note = body.note;
  if (body.amount !== undefined && body.amount !== damage.amount) {
    if (damage.paidAmount > body.amount) {
      throw new ApiError(409, "Yangi summa to'langan miqdordan kichik bo'lolmaydi");
    }
    damage.amount = body.amount;
    recomputeDamageStatus(damage);
  }
  await damage.save();
  return damage;
};

export const remove = async (id) => {
  const damage = await Damage.findById(id);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  if (damage.paidAmount > 0) {
    throw new ApiError(409, "Avval to'lovlarni bekor qiling");
  }
  await DamagePayment.deleteMany({ damage: damage._id });
  await Transaction.deleteMany({ damage: damage._id });
  await damage.deleteOne();
};
