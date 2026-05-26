import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import Car from "../../../models/car.model.js";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Oylik from "../../../models/oylik.model.js";
import DriverDocumentType from "../../../models/driverDocumentType.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS, TARIFF_CONFIG } from "../../../constants/tariffs.js";
import { startOfDayTashkent, daysBetween, addDays } from "../../../utils/timezone.js";
import { removeFileByUrl, fileToPublicUrl } from "../../../utils/fileStorage.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getActiveTariffPhase = (driver, asOf = new Date()) => {
  const cfg = TARIFF_CONFIG[driver.tariff];
  if (driver.tariff === TARIFFS.DEPOSIT) {
    return { phase: "deposit", dailyPlan: cfg.dailyPlan };
  }
  const ref = startOfDayTashkent(asOf);

  // Qo'lda tugatilgan sinov
  if (driver.trialEndedAt && ref >= startOfDayTashkent(driver.trialEndedAt)) {
    return { phase: "salary", dailyPlan: cfg.dailyPlan };
  }

  // Avtomatik (startDate + trialDays)
  const diff = daysBetween(driver.startDate, ref);
  if (diff < cfg.trialDays) {
    return { phase: "trial", dailyPlan: cfg.dailyPlan, trialDaysLeft: cfg.trialDays - diff };
  }
  return { phase: "salary", dailyPlan: cfg.dailyPlan };
};

export const endTrial = async (id, endDateInput) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.tariff !== TARIFFS.NO_DEPOSIT) {
    throw new ApiError(400, "Sinov muddati faqat depozitsiz tarifda mavjud");
  }
  if (driver.status !== DRIVER_STATUS.ACTIVE) {
    throw new ApiError(409, "Haydovchi faol emas");
  }

  const endDate = startOfDayTashkent(endDateInput || new Date());
  const startDay = startOfDayTashkent(driver.startDate);
  const autoEnd = startOfDayTashkent(
    addDays(driver.startDate, TARIFF_CONFIG[TARIFFS.NO_DEPOSIT].trialDays),
  );

  if (endDate < startDay) {
    throw new ApiError(400, "Sinov tugash sanasi boshlanish sanasidan oldin bo'la olmaydi");
  }
  if (endDate > autoEnd) {
    throw new ApiError(400, "Sinov tugash sanasi avtomatik tugash sanasidan keyin bo'la olmaydi");
  }

  driver.trialEndedAt = endDate;
  await driver.save();

  // Oylikni moslash (dynamic import - circular dependency'dan qochish)
  const { syncFirstOylikStart } = await import("../../oyliklar/services/oyliklar.service.js");
  await syncFirstOylikStart(driver, endDate);

  return driver;
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
    if (tariff && tariff !== TARIFFS.DEPOSIT) {
      throw new ApiError(400, "depositBelow faqat depozit tarifi uchun");
    }
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
      .populate("car", "plateNumber model photoUrl notes isActive")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Driver.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const driver = await Driver.findById(id)
    .populate("car", "plateNumber model photoUrl notes isActive")
    .populate("documents.documentType", "name");
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
    photoUrl: body.photoUrl || "",
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

  let oldPhotoUrl = null;
  if (body.photoUrl !== undefined && body.photoUrl !== driver.photoUrl) {
    oldPhotoUrl = driver.photoUrl;
    driver.photoUrl = body.photoUrl;
  }

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
  if (oldPhotoUrl) removeFileByUrl(oldPhotoUrl);
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
    // Lazy yaratish: salary fazada yetishmagan oyliklarni yaratamiz
    if (phase.phase === "salary" && driver.status === DRIVER_STATUS.ACTIVE) {
      const { ensureOyliklar } = await import("../../oyliklar/services/oyliklar.service.js");
      await ensureOyliklar(driver, new Date());
    }
    const oylik = await Oylik.findOne({ driver: driver._id }).sort({ oylikNumber: -1 });

    if (oylik) {
      const planDeficit = Math.max(0, oylik.expectedPlanTotal - oylik.paidTotal);
      const deductions = planDeficit + oylik.finesTotal + oylik.damagesTotal;
      const earnedPayout = Math.max(0, oylik.salary - deductions);
      const remainingPayout = Math.max(0, earnedPayout - oylik.paidOut);
      const debt = Math.max(0, deductions - oylik.salary);
      const isLate = Date.now() > new Date(oylik.dueDate).getTime();
      const lateDays = isLate ? Math.floor((Date.now() - new Date(oylik.dueDate).getTime()) / 86_400_000) : 0;
      result.oylik = {
        ...oylik.toJSON(),
        planDeficit,
        deductions,
        earnedPayout,
        remainingPayout,
        debt,
        isLate,
        lateDays,
      };
      if (debt > 0) result.warnings.push({ code: "debtor", debt });
      if (isLate) result.warnings.push({ code: "oylik_late", lateDays });
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

const buildFilesPayload = (files = []) =>
  files.map((f) => ({
    url: fileToPublicUrl(f),
    filename: f.originalname,
    mime: f.mimetype,
    size: f.size,
  }));

const cleanupUploadedFiles = (files = []) => {
  for (const f of files) removeFileByUrl(fileToPublicUrl(f));
};

const populateDriverDocs = (q) =>
  q
    .populate("car", "plateNumber model")
    .populate("documents.documentType", "name");

export const addDocument = async (
  driverId,
  { documentType, expiryDate },
  files = [],
) => {
  const driver = await Driver.findById(driverId);
  if (!driver) {
    cleanupUploadedFiles(files);
    throw new ApiError(404, "Haydovchi topilmadi");
  }
  const typeDoc = await DriverDocumentType.findById(documentType);
  if (!typeDoc) {
    cleanupUploadedFiles(files);
    throw new ApiError(404, "Hujjat turi topilmadi");
  }
  driver.documents.push({
    documentType,
    expiryDate: expiryDate || null,
    files: buildFilesPayload(files),
  });
  await driver.save();
  return populateDriverDocs(Driver.findById(driver._id));
};

export const updateDocument = async (
  driverId,
  docId,
  { expiryDate, removeFileUrls = [] },
  files = [],
) => {
  const driver = await Driver.findById(driverId);
  if (!driver) {
    cleanupUploadedFiles(files);
    throw new ApiError(404, "Haydovchi topilmadi");
  }
  const doc = driver.documents.id(docId);
  if (!doc) {
    cleanupUploadedFiles(files);
    throw new ApiError(404, "Hujjat topilmadi");
  }

  if (expiryDate !== undefined) doc.expiryDate = expiryDate || null;

  if (Array.isArray(removeFileUrls) && removeFileUrls.length) {
    const toRemove = new Set(removeFileUrls);
    doc.files = doc.files.filter((f) => {
      if (toRemove.has(f.url)) {
        removeFileByUrl(f.url);
        return false;
      }
      return true;
    });
  }

  if (files.length) {
    doc.files.push(...buildFilesPayload(files));
  }

  await driver.save();
  return populateDriverDocs(Driver.findById(driver._id));
};

export const removeDocument = async (driverId, docId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  const doc = driver.documents.id(docId);
  if (!doc) throw new ApiError(404, "Hujjat topilmadi");
  for (const f of doc.files || []) removeFileByUrl(f.url);
  doc.deleteOne();
  await driver.save();
  return populateDriverDocs(Driver.findById(driver._id));
};
