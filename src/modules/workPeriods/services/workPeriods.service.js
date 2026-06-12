import WorkPeriod, { TARIFF } from "../../../models/workPeriod.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;

// endDate = null bo'lsa davr ochiq => +cheksiz.
const endMs = (period) =>
  period.endDate == null ? POSITIVE_INFINITY : startOfDayTashkent(period.endDate).getTime();

const startMs = (period) => startOfDayTashkent(period.startDate).getTime();

// Ikki davr [start, end] (inclusive, null end = cheksiz) bir-biriga to'qnashadimi?
const overlaps = (a, b) => startMs(a) <= endMs(b) && startMs(b) <= endMs(a);

const assertNoConflict = (candidate, existing) => {
  for (const period of existing) {
    if (overlaps(candidate, period)) {
      throw new ApiError(
        409,
        "Bu sana oralig'i mavjud ish davri bilan to'qnashadi. Avval eski davrni yakunlang.",
      );
    }
  }
};

// §5 referensial qulf - davrga bog'langan moliyaviy yozuv bo'lsa o'zgartirib/
// o'chirib bo'lmaydi. Moliya moduli hali yo'q; tayyor bo'lganda shu yerda tekshiriladi.
// eslint-disable-next-line no-unused-vars
const assertNoLinkedTransactions = async (_period) => {
  // TODO(moliya): kunlik plan / tranzaksiya bog'langan bo'lsa ApiError(409) tashlash.
};

export const list = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  return WorkPeriod.find({ driver: driverId }).sort({ startDate: -1 });
};

export const create = async (driverId, body, currentUser) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");

  const startDate = startOfDayTashkent(body.startDate);
  const endDate = body.endDate ? startOfDayTashkent(body.endDate) : null;
  if (endDate && endDate < startDate) {
    throw new ApiError(409, "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
  }

  const existing = await WorkPeriod.find({ driver: driverId });
  assertNoConflict({ startDate, endDate }, existing);

  return WorkPeriod.create({
    driver: driverId,
    tariff: body.tariff,
    startDate,
    endDate,
    note: body.note || "",
    createdBy: currentUser._id,
  });
};

export const update = async (id, body) => {
  const period = await WorkPeriod.findById(id);
  if (!period) throw new ApiError(404, "Ish davri topilmadi");

  // §5: tarifni o'zgartirish faqat bog'langan tranzaksiya bo'lmasa.
  if (body.tariff !== undefined && body.tariff !== period.tariff) {
    await assertNoLinkedTransactions(period);
    period.tariff = body.tariff;
  }

  const nextStart =
    body.startDate !== undefined ? startOfDayTashkent(body.startDate) : startOfDayTashkent(period.startDate);
  const nextEnd =
    body.endDate !== undefined
      ? body.endDate
        ? startOfDayTashkent(body.endDate)
        : null
      : period.endDate;

  if (nextEnd && nextEnd < nextStart) {
    throw new ApiError(409, "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
  }

  // Sana o'zgarsa, boshqa davrlar bilan to'qnashuvni qayta tekshiramiz (§4).
  const datesChanged =
    nextStart.getTime() !== startOfDayTashkent(period.startDate).getTime() ||
    endMs({ endDate: nextEnd }) !== endMs(period);
  if (datesChanged) {
    const others = await WorkPeriod.find({ driver: period.driver, _id: { $ne: period._id } });
    assertNoConflict({ startDate: nextStart, endDate: nextEnd }, others);
  }

  period.startDate = nextStart;
  period.endDate = nextEnd;
  if (body.note !== undefined) period.note = body.note;

  await period.save();
  return period;
};

export const remove = async (id) => {
  const period = await WorkPeriod.findById(id);
  if (!period) throw new ApiError(404, "Ish davri topilmadi");
  await assertNoLinkedTransactions(period);
  await period.deleteOne();
};

// --- Derived holat (haydovchilarni bezash uchun) ---

// Bir nechta haydovchi uchun bugun faol bo'lgan davrni qaytaradi: Map<driverId, period>.
export const activePeriodsByDriver = async (driverIds) => {
  if (!driverIds.length) return new Map();
  const today = startOfDayTashkent(new Date());
  const periods = await WorkPeriod.find({
    driver: { $in: driverIds },
    startDate: { $lte: today },
    $or: [{ endDate: null }, { endDate: { $gte: today } }],
  });
  const map = new Map();
  for (const p of periods) map.set(String(p.driver), p);
  return map;
};

// Bugun faol davri bor haydovchi id'lari (Ishda/Ishlamayotgan filtri uchun).
export const workingDriverIds = async () => {
  const today = startOfDayTashkent(new Date());
  return WorkPeriod.distinct("driver", {
    startDate: { $lte: today },
    $or: [{ endDate: null }, { endDate: { $gte: today } }],
  });
};

// Bitta haydovchining eng erta ish boshlash sanasi (ish boshlash sanasi sifatida).
export const firstStartDate = async (driverId) => {
  const earliest = await WorkPeriod.findOne({ driver: driverId }).sort({ startDate: 1 });
  return earliest ? earliest.startDate : null;
};

export { TARIFF };
