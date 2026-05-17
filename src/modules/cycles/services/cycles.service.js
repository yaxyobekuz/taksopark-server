import MonthlyCycle, { CYCLE_STATUS } from "../../../models/monthlyCycle.model.js";
import Driver from "../../../models/driver.model.js";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS, TARIFF_CONFIG } from "../../../constants/tariffs.js";
import { startOfDayTashkent, addDays, addMonths, daysBetween, endOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";

export const ensureCurrentCycle = async (driver, asOf) => {
  if (driver.tariff !== TARIFFS.NO_DEPOSIT) return null;
  const cfg = TARIFF_CONFIG[TARIFFS.NO_DEPOSIT];
  const ref = startOfDayTashkent(asOf);
  const phase = getActiveTariffPhase(driver, ref);
  if (phase.phase !== "salary") return null;

  const open = await MonthlyCycle.findOne({ driver: driver._id, status: CYCLE_STATUS.OPEN });
  if (open) {
    if (ref >= open.startDate && ref <= open.endDate) return open;
    throw new ApiError(409, "Avvalgi oylik tsikl yopilmagan. Avval yakunlang");
  }

  const count = await MonthlyCycle.countDocuments({ driver: driver._id });

  let startDate;
  if (count === 0) {
    startDate = startOfDayTashkent(addDays(driver.startDate, cfg.trialDays));
  } else {
    const prev = await MonthlyCycle.findOne({ driver: driver._id }).sort({ cycleNumber: -1 });
    startDate = startOfDayTashkent(addDays(prev.endDate, 1));
  }
  const nextStart = startOfDayTashkent(addMonths(startDate, 1));
  const endDate = endOfDayTashkent(addDays(nextStart, -1));
  const days = daysBetween(startDate, endDate) + 1;

  const cycle = await MonthlyCycle.create({
    driver: driver._id,
    car: driver.car,
    cycleNumber: count + 1,
    startDate,
    endDate,
    expectedPlanTotal: days * cfg.dailyPlan,
    salary: cfg.monthlySalary,
  });
  return cycle;
};

export const list = async ({ driverId, status, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MonthlyCycle.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model")
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit),
    MonthlyCycle.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const cycle = await MonthlyCycle.findById(id)
    .populate("driver", "firstName lastName phone tariff")
    .populate("car", "plateNumber model");
  if (!cycle) throw new ApiError(404, "Tsikl topilmadi");
  const [payments, fines, damages] = await Promise.all([
    DailyPayment.find({ cycle: cycle._id }).sort({ date: -1 }),
    Fine.find({ cycle: cycle._id }).sort({ issueDate: -1 }),
    Damage.find({ cycle: cycle._id }).sort({ incidentDate: -1 }),
  ]);
  const planDeficit = Math.max(0, cycle.expectedPlanTotal - cycle.paidTotal);
  const deductions = planDeficit + cycle.finesTotal + cycle.damagesTotal;
  const payout = Math.max(0, cycle.salary - deductions);
  const debt = Math.max(0, deductions - cycle.salary);
  return {
    cycle,
    ledger: { payments, fines, damages },
    summary: { planDeficit, deductions, payout, debt },
  };
};

export const currentForDriver = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  const cycle = await MonthlyCycle.findOne({ driver: driver._id, status: CYCLE_STATUS.OPEN });
  return { driver, cycle };
};

export const settle = async (id, currentUser) => {
  const cycle = await MonthlyCycle.findById(id);
  if (!cycle) throw new ApiError(404, "Tsikl topilmadi");
  if (cycle.status === CYCLE_STATUS.SETTLED) {
    throw new ApiError(409, "Tsikl allaqachon yakunlangan");
  }
  cycle.planDeficit = Math.max(0, cycle.expectedPlanTotal - cycle.paidTotal);
  const totalDeductions = cycle.planDeficit + cycle.finesTotal + cycle.damagesTotal;
  cycle.finalPayout = Math.max(0, cycle.salary - totalDeductions);
  cycle.debtCarried = Math.max(0, totalDeductions - cycle.salary);
  cycle.status = CYCLE_STATUS.SETTLED;
  cycle.settledAt = new Date();
  cycle.settledBy = currentUser._id;
  await cycle.save();

  const driver = await Driver.findById(cycle.driver);
  if (driver && driver.status === "active") {
    await ensureCurrentCycle(driver, addDays(cycle.endDate, 1));
  }
  return cycle;
};
