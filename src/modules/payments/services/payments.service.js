import DailyPayment from "../../../models/dailyPayment.model.js";
import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import Oylik from "../../../models/oylik.model.js";
import Transaction, { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../../../models/transaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS } from "../../../constants/tariffs.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";

const applyDepositDelta = async (driver, delta) => {
  if (driver.tariff !== TARIFFS.DEPOSIT) return;
  driver.depositRemaining = Math.max(0, driver.depositRemaining + delta);
  await driver.save();
};

const applyOylikDelta = async (oylikId, paidDelta) => {
  if (!oylikId) return;
  await Oylik.updateOne({ _id: oylikId }, { $inc: { paidTotal: paidDelta } });
};

const depositDeficit = (expected, paid) => Math.max(0, expected - paid);

// Kunlik to'lov o'zgarganda mos Transaction yozuvini moslaydi.
const syncPaymentTransaction = async (payment, currentUser) => {
  if (payment.amount > 0) {
    const updated = await Transaction.updateOne(
      { dailyPayment: payment._id },
      { $set: { amount: payment.amount, date: payment.date, note: payment.note || "" } },
    );
    if (updated.matchedCount === 0) {
      await Transaction.create({
        type: TRANSACTION_TYPES.INCOME,
        source: TRANSACTION_SOURCES.DAILY_PAYMENT,
        amount: payment.amount,
        date: payment.date,
        driver: payment.driver,
        dailyPayment: payment._id,
        note: payment.note || "",
        createdBy: currentUser._id,
      });
    }
  } else {
    await Transaction.deleteMany({ dailyPayment: payment._id });
  }
};

export const list = async ({ driverId, carId, fromDate, toDate, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (carId) filter.car = carId;
  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = startOfDayTashkent(fromDate);
    if (toDate) filter.date.$lte = startOfDayTashkent(toDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    DailyPayment.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    DailyPayment.countDocuments(filter),
  ]);
  return { items, total };
};

export const todayTotal = async ({ date }) => {
  const target = startOfDayTashkent(date || new Date());

  const drivers = await Driver.find({
    status: DRIVER_STATUS.ACTIVE,
    car: { $ne: null },
  })
    .populate("car", "plateNumber model")
    .lean();

  const paidRows = await DailyPayment.aggregate([
    { $match: { date: target } },
    { $group: { _id: "$car", amount: { $sum: "$amount" } } },
  ]);
  const paidByCar = new Map(paidRows.map((r) => [String(r._id), r.amount]));

  const perCar = drivers
    .filter((d) => d.car)
    .map((d) => {
      const phase = getActiveTariffPhase(d, target);
      const expected = phase.phase === "salary" ? 0 : phase.dailyPlan;
      return {
        carId: String(d.car._id),
        plateNumber: d.car.plateNumber,
        model: d.car.model,
        expected,
        amount: paidByCar.get(String(d.car._id)) || 0,
      };
    })
    .sort((a, b) => (a.plateNumber || "").localeCompare(b.plateNumber || ""));

  const totalExpected = perCar.reduce((s, r) => s + r.expected, 0);
  const totalAmount = perCar.reduce((s, r) => s + r.amount, 0);

  return { date: target, totalAmount, totalExpected, perCar };
};

export const create = async (body, currentUser) => {
  const driver = await Driver.findById(body.driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.status !== DRIVER_STATUS.ACTIVE) {
    throw new ApiError(409, "Haydovchi faol emas");
  }
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const date = startOfDayTashkent(body.date);
  const phase = getActiveTariffPhase(driver, date);

  if (driver.tariff === TARIFFS.NO_DEPOSIT && phase.phase === "salary") {
    throw new ApiError(
      409,
      "Oylik fazasidagi haydovchi kunlik to'lov qilmaydi. Kompaniya unga oylik beradi.",
    );
  }

  let payment;
  try {
    payment = await DailyPayment.create({
      driver: driver._id,
      car: driver.car,
      date,
      amount: body.amount,
      expectedPlan: phase.dailyPlan,
      tariffSnapshot: driver.tariff,
      oylik: null,
      note: body.note || "",
      createdBy: currentUser._id,
    });
  } catch (e) {
    if (e?.code === 11000) {
      throw new ApiError(409, "Bu kun uchun to'lov mavjud");
    }
    throw e;
  }

  const deficit = depositDeficit(phase.dailyPlan, body.amount);
  if (deficit > 0) await applyDepositDelta(driver, -deficit);

  if (body.amount > 0) {
    await Transaction.create({
      type: TRANSACTION_TYPES.INCOME,
      source: TRANSACTION_SOURCES.DAILY_PAYMENT,
      amount: body.amount,
      date,
      driver: driver._id,
      dailyPayment: payment._id,
      note: body.note || "",
      createdBy: currentUser._id,
    });
  }

  return payment;
};

export const update = async (id, body, currentUser) => {
  const payment = await DailyPayment.findById(id);
  if (!payment) throw new ApiError(404, "To'lov topilmadi");

  const driver = await Driver.findById(payment.driver);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  if (body.amount !== undefined && body.amount !== payment.amount) {
    const oldDeficit = depositDeficit(payment.expectedPlan, payment.amount);
    const newDeficit = depositDeficit(payment.expectedPlan, body.amount);
    const deltaDeposit = oldDeficit - newDeficit;
    if (deltaDeposit !== 0) await applyDepositDelta(driver, deltaDeposit);
    const deltaPaid = body.amount - payment.amount;
    if (deltaPaid !== 0) await applyOylikDelta(payment.oylik, deltaPaid);
    payment.amount = body.amount;
  }
  if (body.note !== undefined) payment.note = body.note;
  await payment.save();
  await syncPaymentTransaction(payment, currentUser);
  return payment;
};

export const remove = async (id) => {
  const payment = await DailyPayment.findById(id);
  if (!payment) throw new ApiError(404, "To'lov topilmadi");
  const driver = await Driver.findById(payment.driver);
  if (driver) {
    const oldDeficit = depositDeficit(payment.expectedPlan, payment.amount);
    if (oldDeficit > 0) await applyDepositDelta(driver, oldDeficit);
  }
  if (payment.oylik) await applyOylikDelta(payment.oylik, -payment.amount);
  await Transaction.deleteMany({ dailyPayment: payment._id });
  await payment.deleteOne();
};
