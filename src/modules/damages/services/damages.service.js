import Damage from "../../../models/damage.model.js";
import DamagePayment from "../../../models/damagePayment.model.js";
import Transaction from "../../../models/transaction.model.js";
import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import MonthlyCycle from "../../../models/monthlyCycle.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS } from "../../../constants/tariffs.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";
import { ensureCurrentCycle } from "../../cycles/services/cycles.service.js";

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
  const driver = await Driver.findById(body.driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.status === DRIVER_STATUS.ARCHIVED) {
    throw new ApiError(409, "Haydovchi arxivlangan");
  }
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const incidentDate = startOfDayTashkent(body.incidentDate);
  const phase = getActiveTariffPhase(driver, incidentDate);
  const cycle =
    driver.tariff === TARIFFS.NO_DEPOSIT && phase.phase === "salary"
      ? await ensureCurrentCycle(driver, incidentDate)
      : null;

  const damage = await Damage.create({
    driver: driver._id,
    car: driver.car,
    amount: body.amount,
    incidentDate,
    cycle: cycle ? cycle._id : null,
    attachments,
    paidAmount: 0,
    paymentStatus: "pending",
    createdBy: currentUser._id,
    note: body.note || "",
  });

  return damage;
};

export const update = async (id, body) => {
  const damage = await Damage.findById(id);
  if (!damage) throw new ApiError(404, "Zarar topilmadi");
  if (body.note !== undefined) damage.note = body.note;
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
