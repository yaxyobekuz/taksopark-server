import CarPrice from "../../../models/carPrice.model.js";
import Car from "../../../models/car.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;

// endDate = null bo'lsa davr ochiq => +cheksiz.
const endMs = (period) =>
  period.endDate == null ? POSITIVE_INFINITY : startOfDayTashkent(period.endDate).getTime();

const startMs = (period) => startOfDayTashkent(period.startDate).getTime();

// Ikki davr [start, end] (inclusive, null end = cheksiz) bir-biriga to'qnashadimi?
const overlaps = (a, b) => startMs(a) <= endMs(b) && startMs(b) <= endMs(a);

// Bitta davr ikkala tarif narxini saqlaydi => mashina uchun yagona timeline.
const assertNoConflict = (candidate, existing) => {
  for (const period of existing) {
    if (overlaps(candidate, period)) {
      throw new ApiError(
        409,
        "Bu sana oralig'i mavjud narx davri bilan to'qnashadi. Avval eski davrni yakunlang.",
      );
    }
  }
};

// §5 referensial qulf - davrga bog'langan moliyaviy yozuv (kunlik plan/tranzaksiya)
// bo'lsa narx davrini o'zgartirib/o'chirib bo'lmaydi. Moliya moduli hali yo'q;
// tayyor bo'lganda shu yerda tekshiriladi.
// eslint-disable-next-line no-unused-vars
const assertNoLinkedTransactions = async (_period) => {
  // TODO(moliya): kunlik plan / tranzaksiya bog'langan bo'lsa ApiError(409) tashlash.
};

export const list = async (carId) => {
  const car = await Car.findById(carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  return CarPrice.find({ car: carId }).sort({ startDate: -1 });
};

export const create = async (carId, body, currentUser) => {
  const car = await Car.findById(carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");

  const startDate = startOfDayTashkent(body.startDate);
  const endDate = body.endDate ? startOfDayTashkent(body.endDate) : null;
  if (endDate && endDate < startDate) {
    throw new ApiError(409, "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
  }

  const existing = await CarPrice.find({ car: carId });
  assertNoConflict({ startDate, endDate }, existing);

  return CarPrice.create({
    car: carId,
    dailyRateDeposit: Number(body.dailyRateDeposit) || 0,
    dailyRateCashback: Number(body.dailyRateCashback) || 0,
    monthlyCashback: Number(body.monthlyCashback) || 0,
    startDate,
    endDate,
    note: body.note || "",
    createdBy: currentUser._id,
  });
};

export const update = async (id, body) => {
  const period = await CarPrice.findById(id);
  if (!period) throw new ApiError(404, "Narx davri topilmadi");

  const nextStart =
    body.startDate !== undefined
      ? startOfDayTashkent(body.startDate)
      : startOfDayTashkent(period.startDate);
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
    const others = await CarPrice.find({ car: period.car, _id: { $ne: period._id } });
    assertNoConflict({ startDate: nextStart, endDate: nextEnd }, others);
  }

  period.startDate = nextStart;
  period.endDate = nextEnd;
  if (body.dailyRateDeposit !== undefined) period.dailyRateDeposit = Number(body.dailyRateDeposit) || 0;
  if (body.dailyRateCashback !== undefined) period.dailyRateCashback = Number(body.dailyRateCashback) || 0;
  if (body.monthlyCashback !== undefined) period.monthlyCashback = Number(body.monthlyCashback) || 0;
  if (body.note !== undefined) period.note = body.note;

  await period.save();
  return period;
};

export const remove = async (id) => {
  const period = await CarPrice.findById(id);
  if (!period) throw new ApiError(404, "Narx davri topilmadi");
  await assertNoLinkedTransactions(period);
  await period.deleteOne();
};
