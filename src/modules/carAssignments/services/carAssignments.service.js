import CarAssignment from "../../../models/carAssignment.model.js";
import Driver from "../../../models/driver.model.js";
import Car from "../../../models/car.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent, addDays } from "../../../utils/timezone.js";
import {
  transactedRangeForDriverInRange,
  ensureUpToToday,
} from "../../payments/services/dailyPlans.service.js";

const INF = Number.POSITIVE_INFINITY;
const sod = (d) => startOfDayTashkent(d);
const startMs = (p) => sod(p.startDate).getTime();
const endMs = (p) => (p.endDate == null ? INF : sod(p.endDate).getTime());
const overlaps = (a, b) => startMs(a) <= endMs(b) && startMs(b) <= endMs(a);

const assertNoConflict = (candidate, existing, message) => {
  for (const a of existing) {
    if (overlaps(candidate, a)) throw new ApiError(409, message);
  }
};

// §2: bir haydovchi bir vaqtda bitta mashinada; bitta mashina bir vaqtda bitta
// haydovchida - ikkala timeline ham overlap qila olmaydi.
const assertAssignable = async (candidate, { driverId, carId, excludeId }) => {
  const [driverPeriods, carPeriods] = await Promise.all([
    CarAssignment.find({ driver: driverId, ...(excludeId && { _id: { $ne: excludeId } }) }),
    CarAssignment.find({ car: carId, ...(excludeId && { _id: { $ne: excludeId } }) }),
  ]);
  assertNoConflict(
    candidate,
    driverPeriods,
    "Bu sana oralig'ida haydovchiga boshqa mashina biriktirilgan. Avval eski biriktirishni yakunlang.",
  );
  assertNoConflict(
    candidate,
    carPeriods,
    "Bu mashina shu oraliqda boshqa haydovchiga biriktirilgan.",
  );
};

// driver.car (joriy mashina keshi) + car.currentDriver ni bugungi biriktirishga moslaydi (§11A).
const syncCurrentCar = async (driverId) => {
  const today = sod(new Date()).getTime();
  const assignments = await CarAssignment.find({ driver: driverId });
  const current = assignments.find((a) => startMs(a) <= today && today <= endMs(a)) || null;
  const newCarId = current ? String(current.car) : null;

  const driver = await Driver.findById(driverId);
  if (!driver) return;
  const oldCarId = driver.car ? String(driver.car) : null;
  if (oldCarId === newCarId) return;

  if (oldCarId) {
    await Car.updateOne({ _id: oldCarId, currentDriver: driver._id }, { $set: { currentDriver: null } });
  }
  driver.car = newCarId || null;
  await driver.save();
  if (newCarId) {
    await Car.updateOne({ _id: newCarId }, { $set: { currentDriver: driver._id } });
  }
};

// O'zgarishdan keyin tegishli kunlik planlarni yangilaymiz + joriy mashinani sinxronlaymiz.
const afterChange = async (driverId, fromDate) => {
  await syncCurrentCar(driverId);
  if (fromDate) await ensureUpToToday(driverId, fromDate);
};

export const list = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  return CarAssignment.find({ driver: driverId })
    .populate("car", "plateNumber model")
    .sort({ startDate: -1 });
};

export const create = async (driverId, body, currentUser) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  const car = await Car.findById(body.carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");

  const startDate = sod(body.startDate);
  const endDate = body.endDate ? sod(body.endDate) : null;
  if (endDate && endDate < startDate) {
    throw new ApiError(409, "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
  }

  await assertAssignable({ startDate, endDate }, { driverId, carId: body.carId });

  const created = await CarAssignment.create({
    driver: driverId,
    car: body.carId,
    startDate,
    endDate,
    note: body.note || "",
    createdBy: currentUser._id,
  });
  await afterChange(driverId, startDate);
  return CarAssignment.findById(created._id).populate("car", "plateNumber model");
};

export const update = async (id, body) => {
  const assignment = await CarAssignment.findById(id);
  if (!assignment) throw new ApiError(404, "Mashina biriktirish topilmadi");

  const oldStart = sod(assignment.startDate);
  const oldEnd = assignment.endDate ? sod(assignment.endDate) : sod(new Date());
  const carChanged = body.carId !== undefined && String(body.carId) !== String(assignment.car);

  const nextStart = body.startDate !== undefined ? sod(body.startDate) : oldStart;
  const nextEnd =
    body.endDate !== undefined ? (body.endDate ? sod(body.endDate) : null) : assignment.endDate;
  if (nextEnd && nextEnd < nextStart) {
    throw new ApiError(409, "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
  }

  const carId = carChanged ? body.carId : assignment.car;
  const datesChanged = nextStart.getTime() !== oldStart.getTime() || endMs({ endDate: nextEnd }) !== endMs(assignment);

  if (carChanged || datesChanged) {
    await assertAssignable({ startDate: nextStart, endDate: nextEnd }, { driverId: assignment.driver, carId, excludeId: assignment._id });
  }

  // §5 referensial qulf: tranzaksiyali kunni qamragan biriktirishda mashinani
  // o'zgartirib yoki o'sha kunlarni oralig'idan chiqarib bo'lmaydi.
  if (carChanged || datesChanged) {
    const range = await transactedRangeForDriverInRange(assignment.driver, oldStart, oldEnd);
    if (range) {
      if (carChanged) {
        throw new ApiError(409, "Bu biriktirishda to'lov qilingan kunlar bor - mashinani o'zgartirib bo'lmaydi");
      }
      const outOfRange =
        nextStart.getTime() > range.min.getTime() || (nextEnd && nextEnd.getTime() < range.max.getTime());
      if (outOfRange) {
        throw new ApiError(409, "Sana oralig'ini o'zgartirib bo'lmaydi: to'lov qilingan kunlar tashqarida qoladi");
      }
    }
  }

  assignment.car = carId;
  assignment.startDate = nextStart;
  assignment.endDate = nextEnd;
  if (body.note !== undefined) assignment.note = body.note;
  await assignment.save();

  await afterChange(assignment.driver, nextStart < oldStart ? nextStart : oldStart);
  return CarAssignment.findById(assignment._id).populate("car", "plateNumber model");
};

export const remove = async (id) => {
  const assignment = await CarAssignment.findById(id);
  if (!assignment) throw new ApiError(404, "Mashina biriktirish topilmadi");
  const start = sod(assignment.startDate);
  const end = assignment.endDate ? sod(assignment.endDate) : sod(new Date());
  const range = await transactedRangeForDriverInRange(assignment.driver, start, end);
  if (range) {
    throw new ApiError(409, "Bu biriktirishga bog'langan to'lov(lar) mavjud - o'chirib bo'lmaydi");
  }
  const driverId = assignment.driver;
  await assignment.deleteOne();
  await afterChange(driverId, start);
};

// Tezkor "mashinani almashtirish": joriy ochiq biriktirishni yakunlab, yangisini ochadi.
export const changeCar = async (driverId, { carId, fromDate }, currentUser) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  const car = await Car.findById(carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");

  const from = fromDate ? sod(fromDate) : sod(new Date());

  // §5 referensial qulf: almashtirish sanasidan boshlab to'lov qilingan kunlar bo'lsa,
  // o'sha kunlarning mashinasi o'zgarib ketadi — bunga yo'l qo'ymaymiz.
  const txRange = await transactedRangeForDriverInRange(driverId, from, sod(new Date()));
  if (txRange) {
    throw new ApiError(409, "Almashtirish sanasidan keyin to'lov qilingan kunlar bor — mashinani almashtirib bo'lmaydi");
  }

  const open = await CarAssignment.findOne({ driver: driverId, endDate: null });
  if (open) {
    if (sod(open.startDate).getTime() >= from.getTime()) {
      throw new ApiError(409, "Almashtirish sanasi joriy biriktirish boshlanishidan keyin bo'lishi kerak");
    }
    if (String(open.car) === String(carId)) {
      throw new ApiError(409, "Bu mashina allaqachon biriktirilgan");
    }
    open.endDate = sod(addDays(from, -1));
    await open.save();
  }

  await assertAssignable({ startDate: from, endDate: null }, { driverId, carId });
  await CarAssignment.create({
    driver: driverId,
    car: carId,
    startDate: from,
    endDate: null,
    note: "",
    createdBy: currentUser._id,
  });
  await afterChange(driverId, open ? sod(open.startDate) : from);
  return list(driverId);
};

export { syncCurrentCar };
