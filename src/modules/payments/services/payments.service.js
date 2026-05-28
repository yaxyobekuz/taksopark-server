import DailyPayment from "../../../models/dailyPayment.model.js";
import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import Oylik from "../../../models/oylik.model.js";
import Transaction, { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../../../models/transaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS } from "../../../constants/tariffs.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";

// Depozit deltasi: deficit ushlanganda manfiy, ortiqcha to'lovda musbat.
// Manfiy delta depozitni kamaytiradi, 0 dan oshsa qarzga yoziladi.
// Musbat delta avval mavjud qarzni qoplaydi, qolgani depozitga qo'shiladi.
const applyDepositDelta = async (driver, delta) => {
  if (driver.tariff !== TARIFFS.DEPOSIT) return;
  if (delta < 0) {
    const raw = driver.depositRemaining + delta;
    if (raw < 0) {
      driver.totalDebt += -raw;
      driver.depositRemaining = 0;
    } else {
      driver.depositRemaining = raw;
    }
  } else {
    const debtPayoff = Math.min(driver.totalDebt, delta);
    driver.totalDebt -= debtPayoff;
    driver.depositRemaining += delta - debtPayoff;
  }
  await driver.save();
};

const applyOylikDelta = async (oylikId, paidDelta) => {
  if (!oylikId) return;
  await Oylik.updateOne({ _id: oylikId }, { $inc: { paidTotal: paidDelta } });
};

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

export const create = async (body, currentUser) => {
  const driver = await Driver.findById(body.driverId).populate(
    "car",
    "dailyPaymentDeposit dailyPaymentNoDeposit monthlyCashback",
  );
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.status !== DRIVER_STATUS.ACTIVE) {
    throw new ApiError(409, "Haydovchi faol emas");
  }
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const date = startOfDayTashkent(body.date);
  const phase = getActiveTariffPhase(driver, driver.car, date);
  const carId = driver.car._id;

  // Depozitsiz haydovchining kunlik to'lovi joriy oylik davriga bog'lanadi.
  let oylikId = null;
  if (driver.tariff === TARIFFS.NO_DEPOSIT && phase.phase === "salary") {
    const { oylikForDate, ensureOyliklar } = await import(
      "../../oyliklar/services/oyliklar.service.js"
    );
    await ensureOyliklar(driver, date);
    const oylik = await oylikForDate(driver._id, date);
    oylikId = oylik?._id || null;
  }

  let payment;
  try {
    payment = await DailyPayment.create({
      driver: driver._id,
      car: carId,
      date,
      amount: body.amount,
      expectedPlan: phase.dailyPlan,
      tariffSnapshot: driver.tariff,
      oylik: oylikId,
      note: body.note || "",
      createdBy: currentUser._id,
    });
  } catch (e) {
    if (e?.code === 11000) {
      throw new ApiError(409, "Bu kun uchun to'lov mavjud");
    }
    throw e;
  }

  // Depozitli: ortiqcha to'lov depozitga, kam to'lov depozitdan/qarzga.
  if (driver.tariff === TARIFFS.DEPOSIT) {
    const delta = body.amount - phase.dailyPlan;
    if (delta !== 0) await applyDepositDelta(driver, delta);
  }

  // Depozitsiz: kunlik to'lov oylik paidTotal'ga qo'shiladi (deficit cashbackdan ushlanadi).
  if (oylikId) await applyOylikDelta(oylikId, body.amount);

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
    const deltaPaid = body.amount - payment.amount;
    // Depozitli: summa o'zgarishi to'g'ridan-to'g'ri depozitga ta'sir qiladi.
    if (driver.tariff === TARIFFS.DEPOSIT) await applyDepositDelta(driver, deltaPaid);
    if (payment.oylik) await applyOylikDelta(payment.oylik, deltaPaid);
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
  // To'lov o'chirilsa, uning depozitga qo'shgan/ushlagan ta'siri bekor qilinadi.
  if (driver && driver.tariff === TARIFFS.DEPOSIT) {
    await applyDepositDelta(driver, -payment.amount);
  }
  if (payment.oylik) await applyOylikDelta(payment.oylik, -payment.amount);
  await Transaction.deleteMany({ dailyPayment: payment._id });
  await payment.deleteOne();
};
