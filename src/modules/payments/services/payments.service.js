import DailyPayment from "../../../models/dailyPayment.model.js";
import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import MonthlyCycle from "../../../models/monthlyCycle.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS, TARIFF_CONFIG } from "../../../constants/tariffs.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";
import { ensureCurrentCycle } from "../../cycles/services/cycles.service.js";

const applyDepositDelta = async (driver, delta) => {
  if (driver.tariff !== TARIFFS.DEPOSIT) return;
  driver.depositRemaining = Math.max(0, driver.depositRemaining + delta);
  await driver.save();
};

const applyCycleDelta = async (cycleId, paidDelta) => {
  if (!cycleId) return;
  await MonthlyCycle.updateOne({ _id: cycleId }, { $inc: { paidTotal: paidDelta } });
};

const depositDeficit = (expected, paid) => Math.max(0, expected - paid);

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
    .map((d) => ({
      carId: String(d.car._id),
      plateNumber: d.car.plateNumber,
      model: d.car.model,
      expected: TARIFF_CONFIG[d.tariff]?.dailyPlan || 0,
      amount: paidByCar.get(String(d.car._id)) || 0,
    }))
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
  const cycle =
    driver.tariff === TARIFFS.NO_DEPOSIT && phase.phase === "salary"
      ? await ensureCurrentCycle(driver, date)
      : null;

  let payment;
  try {
    payment = await DailyPayment.create({
      driver: driver._id,
      car: driver.car,
      date,
      amount: body.amount,
      expectedPlan: phase.dailyPlan,
      tariffSnapshot: driver.tariff,
      cycle: cycle ? cycle._id : null,
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
  await applyCycleDelta(cycle?._id, body.amount);
  return payment;
};

export const update = async (id, body) => {
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
    if (deltaPaid !== 0) await applyCycleDelta(payment.cycle, deltaPaid);
    payment.amount = body.amount;
  }
  if (body.note !== undefined) payment.note = body.note;
  await payment.save();
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
  if (payment.cycle) await applyCycleDelta(payment.cycle, -payment.amount);
  await payment.deleteOne();
};
