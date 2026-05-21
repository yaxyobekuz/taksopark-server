import Oylik, { OYLIK_STATUS } from "../../../models/oylik.model.js";
import Driver from "../../../models/driver.model.js";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import Transaction, { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../../../models/transaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS, TARIFF_CONFIG } from "../../../constants/tariffs.js";
import { GRACE_DAYS } from "../../../constants/oyliklar.js";
import { startOfDayTashkent, addDays, addMonths, endOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";

export const ensureCurrentOylik = async (driver, asOf) => {
  if (driver.tariff !== TARIFFS.NO_DEPOSIT) return null;
  if (driver.status !== "active") return null;
  if (!driver.car) return null;
  const cfg = TARIFF_CONFIG[TARIFFS.NO_DEPOSIT];
  const ref = startOfDayTashkent(asOf);
  const phase = getActiveTariffPhase(driver, ref);
  if (phase.phase !== "salary") return null;

  const open = await Oylik.findOne({ driver: driver._id, status: OYLIK_STATUS.ACTIVE });
  if (open) {
    if (ref >= open.startDate && ref <= open.endDate) return open;
    throw new ApiError(409, "Avvalgi oylik yopilmagan. Avval yopib qo'ying");
  }

  const count = await Oylik.countDocuments({ driver: driver._id });

  let startDate;
  let carryIn = 0;
  if (count === 0) {
    // Qo'lda tugatilgan sinov bo'lsa - shu kundan boshlanadi
    if (driver.trialEndedAt) {
      startDate = startOfDayTashkent(driver.trialEndedAt);
    } else {
      startDate = startOfDayTashkent(addDays(driver.startDate, cfg.trialDays));
    }
  } else {
    const prev = await Oylik.findOne({ driver: driver._id }).sort({ oylikNumber: -1 });
    startDate = startOfDayTashkent(addDays(prev.endDate, 1));
    carryIn = prev.carryOut || 0;
  }
  const nextStart = startOfDayTashkent(addMonths(startDate, 1));
  const endDate = endOfDayTashkent(addDays(nextStart, -1));
  const dueDate = endOfDayTashkent(addDays(endDate, GRACE_DAYS));

  const oylik = await Oylik.create({
    driver: driver._id,
    car: driver.car,
    oylikNumber: count + 1,
    startDate,
    endDate,
    dueDate,
    expectedPlanTotal: 0,
    salary: cfg.monthlySalary,
    carryIn,
  });
  return oylik;
};

// Sinov tugash sanasi o'zgarganda 1-oylikni moslaydi yoki yangi yaratadi.
export const syncFirstOylikStart = async (driver, trialEndDate) => {
  if (driver.tariff !== TARIFFS.NO_DEPOSIT) return null;
  if (driver.status !== "active" || !driver.car) return null;

  const active = await Oylik.findOne({ driver: driver._id, status: OYLIK_STATUS.ACTIVE });

  if (!active) {
    return ensureCurrentOylik(driver, trialEndDate);
  }

  // Faqat 1-oylik sanasini moslaymiz
  if (active.oylikNumber === 1) {
    const startDate = startOfDayTashkent(trialEndDate);
    const nextStart = startOfDayTashkent(addMonths(startDate, 1));
    const endDate = endOfDayTashkent(addDays(nextStart, -1));
    const dueDate = endOfDayTashkent(addDays(endDate, GRACE_DAYS));
    active.startDate = startDate;
    active.endDate = endDate;
    active.dueDate = dueDate;
    await active.save();
  }
  return active;
};

export const list = async ({ driverId, status, late, page = 1, limit = 20 }) => {
  const filter = {};
  if (driverId) filter.driver = driverId;
  if (status) filter.status = status;
  if (late === true || late === "true") {
    filter.status = OYLIK_STATUS.ACTIVE;
    filter.dueDate = { $lt: new Date() };
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Oylik.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("car", "plateNumber model")
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit),
    Oylik.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const oylik = await Oylik.findById(id)
    .populate("driver", "firstName lastName phone tariff")
    .populate("car", "plateNumber model")
    .populate("payouts.createdBy", "fullName username");
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  const [payments, fines, damages] = await Promise.all([
    DailyPayment.find({ oylik: oylik._id }).sort({ date: -1 }),
    Fine.find({ oylik: oylik._id }).sort({ issueDate: -1 }),
    Damage.find({ oylik: oylik._id }).sort({ incidentDate: -1 }),
  ]);
  return { oylik, ledger: { payments, fines, damages, payouts: oylik.payouts } };
};

export const currentForDriver = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  const oylik = await Oylik.findOne({ driver: driver._id, status: OYLIK_STATUS.ACTIVE });
  return { driver, oylik };
};

export const statementForDriver = async (driverId) => {
  const driver = await Driver.findById(driverId).populate("car", "plateNumber model");
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  // Lazy yaratish: agar no_deposit + salary fazada va active oylik yo'q bo'lsa
  if (driver.tariff === TARIFFS.NO_DEPOSIT && driver.status === "active") {
    const active = await Oylik.findOne({ driver: driverId, status: OYLIK_STATUS.ACTIVE });
    if (!active) {
      const phase = getActiveTariffPhase(driver, new Date());
      if (phase.phase === "salary") {
        await ensureCurrentOylik(driver, new Date());
      }
    }
  }

  const oyliklar = await Oylik.find({ driver: driverId }).sort({ oylikNumber: 1 }).lean({ virtuals: true });

  let running = 0;
  const rows = oyliklar.map((o) => {
    const planDeficit = Math.max(0, o.expectedPlanTotal - o.paidTotal);
    const deductions = planDeficit + o.finesTotal + o.damagesTotal;
    const earned = Math.max(0, o.salary + (o.carryIn || 0) - deductions);
    const remaining = Math.max(0, earned - o.paidOut);
    running += earned - o.paidOut;
    return {
      ...o,
      planDeficit,
      deductions,
      earnedPayout: earned,
      remainingPayout: remaining,
      runningBalance: running,
    };
  });

  const totals = oyliklar.reduce(
    (acc, o) => ({
      salary: acc.salary + o.salary,
      paidOut: acc.paidOut + o.paidOut,
      fines: acc.fines + o.finesTotal,
      damages: acc.damages + o.damagesTotal,
      collected: acc.collected + o.paidTotal,
    }),
    { salary: 0, paidOut: 0, fines: 0, damages: 0, collected: 0 },
  );

  return { driver, totals, rows, currentBalance: running };
};

export const addPayout = async (id, body, currentUser) => {
  const oylik = await Oylik.findById(id);
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  if (oylik.status === OYLIK_STATUS.CLOSED) {
    throw new ApiError(409, "Yopilgan oylikga to'lov qo'shib bo'lmaydi");
  }
  if (!body.amount || body.amount <= 0) {
    throw new ApiError(400, "To'lov summasi noto'g'ri");
  }

  const planDeficit = Math.max(0, oylik.expectedPlanTotal - oylik.paidTotal);
  const deductions = planDeficit + oylik.finesTotal + oylik.damagesTotal;
  const earned = Math.max(0, oylik.salary + (oylik.carryIn || 0) - deductions);
  const remaining = Math.max(0, earned - oylik.paidOut);
  if (body.amount > remaining) {
    throw new ApiError(400, `Hisoblangan haqdan oshib ketdi. Qoldi: ${remaining}`);
  }

  const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
  oylik.payouts.push({
    amount: body.amount,
    paidAt,
    note: body.note || "",
    createdBy: currentUser._id,
  });
  oylik.paidOut += body.amount;
  await oylik.save();
  const lastPayout = oylik.payouts[oylik.payouts.length - 1];

  await Transaction.create({
    type: TRANSACTION_TYPES.EXPENSE,
    source: TRANSACTION_SOURCES.OYLIK_PAYOUT,
    amount: body.amount,
    date: paidAt,
    driver: oylik.driver,
    oylik: oylik._id,
    payoutId: lastPayout._id,
    note: body.note || "",
    createdBy: currentUser._id,
  });

  return oylik;
};

export const removePayout = async (oylikId, payoutId) => {
  const oylik = await Oylik.findById(oylikId);
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  if (oylik.status === OYLIK_STATUS.CLOSED) {
    throw new ApiError(409, "Yopilgan oylik to'lovini o'chirib bo'lmaydi");
  }
  const payout = oylik.payouts.id(payoutId);
  if (!payout) throw new ApiError(404, "To'lov topilmadi");

  oylik.paidOut = Math.max(0, oylik.paidOut - payout.amount);
  payout.deleteOne();
  await oylik.save();

  await Transaction.deleteMany({ payoutId });
  return oylik;
};

export const close = async (id, currentUser) => {
  const oylik = await Oylik.findById(id);
  if (!oylik) throw new ApiError(404, "Oylik topilmadi");
  if (oylik.status === OYLIK_STATUS.CLOSED) {
    throw new ApiError(409, "Oylik allaqachon yopilgan");
  }

  const planDeficit = Math.max(0, oylik.expectedPlanTotal - oylik.paidTotal);
  const deductions = planDeficit + oylik.finesTotal + oylik.damagesTotal;
  const earned = oylik.salary + (oylik.carryIn || 0) - deductions;
  const net = earned - oylik.paidOut;

  oylik.closedPlanDeficit = planDeficit;
  oylik.closedDeductions = deductions;
  oylik.closedEarnedPayout = Math.max(0, earned);
  oylik.closedLateDays = Math.max(0, Math.floor((Date.now() - oylik.dueDate.getTime()) / 86_400_000));
  oylik.carryOut = net;
  oylik.status = OYLIK_STATUS.CLOSED;
  oylik.closedAt = new Date();
  oylik.closedBy = currentUser._id;
  await oylik.save();

  const driver = await Driver.findById(oylik.driver);
  if (driver && driver.status === "active") {
    const next = await ensureCurrentOylik(driver, addDays(oylik.endDate, 1));
    if (next) {
      next.carryIn = oylik.carryOut;
      await next.save();
    }
  }
  return oylik;
};
