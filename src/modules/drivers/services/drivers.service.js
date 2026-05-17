import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import Car from "../../../models/car.model.js";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import MonthlyCycle, { CYCLE_STATUS } from "../../../models/monthlyCycle.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS, TARIFF_CONFIG } from "../../../constants/tariffs.js";
import { startOfDayTashkent, daysBetween } from "../../../utils/timezone.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getActiveTariffPhase = (driver, asOf = new Date()) => {
  const cfg = TARIFF_CONFIG[driver.tariff];
  if (driver.tariff === TARIFFS.DEPOSIT) {
    return { phase: "deposit", dailyPlan: cfg.dailyPlan };
  }
  const diff = daysBetween(driver.startDate, asOf);
  if (diff < cfg.trialDays) {
    return { phase: "trial", dailyPlan: cfg.dailyPlan, trialDaysLeft: cfg.trialDays - diff };
  }
  return { phase: "salary", dailyPlan: cfg.dailyPlan };
};

const detachCarFromDriver = async (driver) => {
  if (driver.car) {
    await Car.updateOne({ _id: driver.car }, { $set: { currentDriver: null } });
  }
};

const attachCarToDriver = async (driver, carId) => {
  const car = await Car.findById(carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  if (!car.isActive) throw new ApiError(409, "Mashina faol emas");
  const existingActive = await Driver.findOne({
    car: carId,
    status: DRIVER_STATUS.ACTIVE,
    _id: { $ne: driver._id },
  });
  if (existingActive) {
    throw new ApiError(409, "Bu mashina boshqa faol haydovchiga biriktirilgan");
  }
  driver.car = carId;
  await Car.updateOne({ _id: carId }, { $set: { currentDriver: driver._id } });
};

export const list = async ({ tariff, status, carId, search, depositBelow, page = 1, limit = 20 }) => {
  const filter = {};
  if (tariff) filter.tariff = tariff;
  if (status) filter.status = status;
  if (carId) filter.car = carId;
  if (depositBelow !== undefined) {
    filter.tariff = TARIFFS.DEPOSIT;
    filter.depositRemaining = { $lt: Number(depositBelow) };
  }
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }, { phone: rx }];
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Driver.find(filter)
      .populate("car", "plateNumber model")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Driver.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const driver = await Driver.findById(id).populate("car", "plateNumber model");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  return driver;
};

export const create = async (body) => {
  if (body.tariff === TARIFFS.DEPOSIT && !body.carId) {
    throw new ApiError(400, "Mashina biriktirish majburiy");
  }
  const exists = await Driver.findOne({ phone: body.phone });
  if (exists) throw new ApiError(409, "Bu telefon raqamli haydovchi mavjud");
  const cfg = TARIFF_CONFIG[body.tariff];
  const driver = new Driver({
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    tariff: body.tariff,
    startDate: startOfDayTashkent(body.startDate),
    depositInitial: cfg.depositInitial,
    depositRemaining: cfg.depositInitial,
    notes: body.notes || "",
  });
  if (body.carId) {
    await attachCarToDriver(driver, body.carId);
  }
  await driver.save();
  return driver;
};

export const update = async (id, body) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (body.phone && body.phone !== driver.phone) {
    const dupe = await Driver.findOne({ phone: body.phone, _id: { $ne: driver._id } });
    if (dupe) throw new ApiError(409, "Bu telefon raqamli haydovchi mavjud");
    driver.phone = body.phone;
  }
  if (body.firstName !== undefined) driver.firstName = body.firstName;
  if (body.lastName !== undefined) driver.lastName = body.lastName;
  if (body.notes !== undefined) driver.notes = body.notes;

  if (body.carId !== undefined) {
    if (body.carId === null) {
      await detachCarFromDriver(driver);
      driver.car = null;
    } else if (String(driver.car) !== String(body.carId)) {
      await detachCarFromDriver(driver);
      await attachCarToDriver(driver, body.carId);
    }
  }
  await driver.save();
  return driver;
};

export const block = async (id, reason) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.status === DRIVER_STATUS.BLOCKED) {
    throw new ApiError(409, "Haydovchi allaqachon bloklangan");
  }
  driver.status = DRIVER_STATUS.BLOCKED;
  driver.blockReason = reason;
  driver.blockedAt = new Date();
  await driver.save();
  return driver;
};

export const unblock = async (id) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.status !== DRIVER_STATUS.BLOCKED) {
    throw new ApiError(409, "Haydovchi bloklangan emas");
  }
  driver.status = DRIVER_STATUS.ACTIVE;
  driver.blockReason = "";
  driver.blockedAt = null;
  await driver.save();
  return driver;
};

export const softRemove = async (id) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  await detachCarFromDriver(driver);
  driver.car = null;
  driver.status = DRIVER_STATUS.ARCHIVED;
  await driver.save();
  return driver;
};

export const getBalance = async (id) => {
  const driver = await Driver.findById(id).populate("car", "plateNumber model");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  const phase = getActiveTariffPhase(driver);
  const result = { driver, phase, tariff: driver.tariff, warnings: [] };

  if (driver.tariff === TARIFFS.DEPOSIT) {
    result.deposit = {
      initial: driver.depositInitial,
      remaining: driver.depositRemaining,
    };
    const threshold = TARIFF_CONFIG[TARIFFS.DEPOSIT].depositWarnThreshold;
    if (driver.depositRemaining <= 0) result.warnings.push({ code: "deposit_empty" });
    else if (driver.depositRemaining < threshold) {
      result.warnings.push({ code: "deposit_low", threshold });
    }
  } else {
    const cycle = await MonthlyCycle.findOne({ driver: driver._id, status: CYCLE_STATUS.OPEN });
    if (cycle) {
      const planDeficit = Math.max(0, cycle.expectedPlanTotal - cycle.paidTotal);
      const deductions = planDeficit + cycle.finesTotal + cycle.damagesTotal;
      const payout = Math.max(0, cycle.salary - deductions);
      const debt = Math.max(0, deductions - cycle.salary);
      result.cycle = {
        ...cycle.toJSON(),
        planDeficit,
        deductions,
        payout,
        debt,
      };
      if (debt > 0) result.warnings.push({ code: "debtor", debt });
    }
  }

  const lastPayment = await DailyPayment.findOne({ driver: driver._id }).sort({ date: -1 });
  const today = startOfDayTashkent(new Date());
  if (!lastPayment) {
    const since = daysBetween(driver.startDate, today);
    if (since > 2) result.warnings.push({ code: "no_payment_2_days", daysSince: since });
  } else if (daysBetween(lastPayment.date, today) > 2) {
    result.warnings.push({
      code: "no_payment_2_days",
      daysSince: daysBetween(lastPayment.date, today),
    });
  }
  return result;
};

export const warnings = async () => {
  const threshold = TARIFF_CONFIG[TARIFFS.DEPOSIT].depositWarnThreshold;
  const today = startOfDayTashkent(new Date());

  const depositLow = await Driver.find({
    tariff: TARIFFS.DEPOSIT,
    status: DRIVER_STATUS.ACTIVE,
    depositRemaining: { $gt: 0, $lt: threshold },
  })
    .populate("car", "plateNumber model")
    .sort({ depositRemaining: 1 });

  const depositEmpty = await Driver.find({
    tariff: TARIFFS.DEPOSIT,
    status: DRIVER_STATUS.ACTIVE,
    depositRemaining: { $lte: 0 },
  })
    .populate("car", "plateNumber model")
    .sort({ depositRemaining: 1 });

  const activeDrivers = await Driver.find({ status: DRIVER_STATUS.ACTIVE })
    .populate("car", "plateNumber model");
  const noPayment2Days = [];
  for (const d of activeDrivers) {
    const last = await DailyPayment.findOne({ driver: d._id }).sort({ date: -1 });
    const ref = last ? last.date : d.startDate;
    const days = daysBetween(ref, today);
    if (days > 2) noPayment2Days.push({ driver: d, daysSince: days, lastPaymentAt: last?.date || null });
  }

  return { depositLow, depositEmpty, noPayment2Days };
};

export const recompute = async (id) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  if (driver.tariff === TARIFFS.DEPOSIT) {
    const payments = await DailyPayment.find({ driver: driver._id });
    let deficitSum = 0;
    for (const p of payments) {
      deficitSum += Math.max(0, p.expectedPlan - p.amount);
    }
    const finesAgg = await Fine.aggregate([
      { $match: { driver: driver._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const damagesAgg = await Damage.aggregate([
      { $match: { driver: driver._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const fines = finesAgg[0]?.total || 0;
    const damages = damagesAgg[0]?.total || 0;
    driver.depositRemaining = Math.max(0, driver.depositInitial - deficitSum - fines - damages);
    await driver.save();
  }

  const cycles = await MonthlyCycle.find({ driver: driver._id, status: CYCLE_STATUS.OPEN });
  for (const cycle of cycles) {
    const paidAgg = await DailyPayment.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const finesAgg = await Fine.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const damagesAgg = await Damage.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    cycle.paidTotal = paidAgg[0]?.total || 0;
    cycle.finesTotal = finesAgg[0]?.total || 0;
    cycle.damagesTotal = damagesAgg[0]?.total || 0;
    await cycle.save();
  }
  return driver;
};
