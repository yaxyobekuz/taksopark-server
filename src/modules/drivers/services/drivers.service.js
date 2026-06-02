import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import Car from "../../../models/car.model.js";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Oylik from "../../../models/oylik.model.js";
import DriverDocumentType from "../../../models/driverDocumentType.model.js";
import ApiError from "../../../utils/ApiError.js";
import { TARIFFS, ALL_TARIFFS, TARIFF_CONFIG, DEPOSIT_WARN_THRESHOLD } from "../../../constants/tariffs.js";
import {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_SOURCES,
  TRANSACTION_WALLETS,
} from "../../../models/transaction.model.js";
import { writeLinkedTxs } from "../../../helpers/walletTransaction.helper.js";
import { startOfDayTashkent, daysBetween, addDays } from "../../../utils/timezone.js";
import { removeFileByUrl, fileToPublicUrl } from "../../../utils/fileStorage.js";
import { applyDepositDelta } from "../../../helpers/driverFinance.helper.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mashinadan tarifga mos narxni oladi (kunlik to'lov + cashback). car populate
// qilingan obyekt yoki alohida uzatilishi mumkin.
const resolveCarPricing = (driver, car) => {
  const c = car || driver.car;
  if (!c || typeof c !== "object" || c.dailyPaymentDeposit === undefined) {
    throw new ApiError(409, "Mashina narxlari aniqlanmagan. Mashina biriktiring");
  }
  return {
    dailyPlan:
      driver.tariff === TARIFFS.DEPOSIT ? c.dailyPaymentDeposit : c.dailyPaymentNoDeposit,
    cashback: c.monthlyCashback,
  };
};

export const getActiveTariffPhase = (driver, car, asOf = new Date()) => {
  const cfg = TARIFF_CONFIG[driver.tariff];
  const pricing = resolveCarPricing(driver, car);

  if (driver.tariff === TARIFFS.DEPOSIT) {
    return { phase: "deposit", dailyPlan: pricing.dailyPlan };
  }
  const ref = startOfDayTashkent(asOf);

  // Qo'lda tugatilgan sinov
  if (driver.trialEndedAt && ref >= startOfDayTashkent(driver.trialEndedAt)) {
    return { phase: "salary", dailyPlan: pricing.dailyPlan, cashback: pricing.cashback };
  }

  // Avtomatik (startDate + trialDays) - sinovda cashback yo'q
  const diff = daysBetween(driver.startDate, ref);
  if (diff < cfg.trialDays) {
    return { phase: "trial", dailyPlan: pricing.dailyPlan, trialDaysLeft: cfg.trialDays - diff };
  }
  return { phase: "salary", dailyPlan: pricing.dailyPlan, cashback: pricing.cashback };
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
  const depositInitial =
    body.tariff === TARIFFS.DEPOSIT ? Number(body.depositInitial || 0) : 0;
  const driver = new Driver({
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    tariff: body.tariff,
    startDate: startOfDayTashkent(body.startDate),
    depositInitial,
    depositRemaining: depositInitial,
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

// Depozitni qo'shish (topup) yoki qaytarib olish (withdraw). delta musbat=qo'shish.
export const adjustDeposit = async (id, body, currentUser) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.tariff !== TARIFFS.DEPOSIT) {
    throw new ApiError(409, "Depozit faqat depozitli tarifda mavjud");
  }
  const delta = Number(body.delta);
  if (!delta || Number.isNaN(delta)) throw new ApiError(400, "Summa noto'g'ri");
  if (delta < 0 && driver.depositRemaining + delta < 0) {
    throw new ApiError(400, `Depozitda yetarli mablag' yo'q. Qoldi: ${driver.depositRemaining}`);
  }

  const prevDebt = driver.totalDebt;
  await applyDepositDelta(driver, delta);
  driver.depositInitial = Math.max(driver.depositInitial, driver.depositRemaining);
  await driver.save();

  const now = new Date();
  const note = body.note || "";
  const txEntries = [];

  if (delta > 0) {
    const debtRepaid = prevDebt - driver.totalDebt; // 0..delta
    const toDeposit = delta - debtRepaid;
    if (toDeposit > 0) {
      txEntries.push({
        wallet: TRANSACTION_WALLETS.DEPOSIT,
        direction: TRANSACTION_DIRECTIONS.IN,
        source: TRANSACTION_SOURCES.DEPOSIT_TOPUP,
        amount: toDeposit,
        date: now,
        driver: driver._id,
        note,
        createdBy: currentUser._id,
      });
    }
    if (debtRepaid > 0) {
      txEntries.push(
        {
          wallet: TRANSACTION_WALLETS.DEBT,
          direction: TRANSACTION_DIRECTIONS.OUT,
          source: TRANSACTION_SOURCES.DEBT_REPAY_DEPOSIT,
          amount: debtRepaid,
          date: now,
          driver: driver._id,
          note,
          createdBy: currentUser._id,
        },
        {
          wallet: TRANSACTION_WALLETS.EXTERNAL,
          direction: TRANSACTION_DIRECTIONS.IN,
          source: TRANSACTION_SOURCES.DEBT_REPAY_DEPOSIT,
          amount: debtRepaid,
          date: now,
          driver: driver._id,
          note,
          createdBy: currentUser._id,
        },
      );
    }
  } else {
    txEntries.push({
      wallet: TRANSACTION_WALLETS.DEPOSIT,
      direction: TRANSACTION_DIRECTIONS.OUT,
      source: TRANSACTION_SOURCES.DEPOSIT_WITHDRAW,
      amount: Math.abs(delta),
      date: now,
      driver: driver._id,
      note,
      createdBy: currentUser._id,
    });
  }

  await writeLinkedTxs(txEntries);

  return driver;
};

// Tarifni o'zgartirish: moliyani mijoz qoidalariga ko'ra ko'chiradi.
export const changeTariff = async (id, body, currentUser) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (driver.status !== DRIVER_STATUS.ACTIVE) throw new ApiError(409, "Haydovchi faol emas");
  const target = body.tariff;
  if (!ALL_TARIFFS.includes(target)) throw new ApiError(400, "Tarif noto'g'ri");
  if (target === driver.tariff) throw new ApiError(400, "Haydovchi allaqachon shu tarifda");
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");

  const now = startOfDayTashkent(new Date());
  const { computeEarnedRemainder } = await import("../../oyliklar/services/oyliklar.service.js");
  const historyEntry = {
    from: driver.tariff,
    to: target,
    at: now,
    depositReturned: 0,
    cashbackToDeposit: 0,
    debtCarried: driver.totalDebt,
    note: body.note || "",
  };

  if (driver.tariff === TARIFFS.NO_DEPOSIT && target === TARIFFS.DEPOSIT) {
    // Ishlangan (hisoblangan, hali to'lanmagan) cashback depozitga qo'shiladi.
    const earned = await computeEarnedRemainder(driver);
    driver.depositRemaining += earned;
    driver.depositInitial = Math.max(driver.depositInitial, driver.depositRemaining);
    driver.tariff = TARIFFS.DEPOSIT;
    historyEntry.cashbackToDeposit = earned;
  } else {
    // deposit -> no_deposit: depozit qaytariladi, cashback darhol boshlanadi (sinovsiz).
    const refund = driver.depositRemaining;
    if (refund > 0) {
      await writeLinkedTxs([
        {
          wallet: TRANSACTION_WALLETS.DEPOSIT,
          direction: TRANSACTION_DIRECTIONS.OUT,
          source: TRANSACTION_SOURCES.DEPOSIT_REFUND,
          amount: refund,
          date: new Date(),
          driver: driver._id,
          note: body.note || "Tarif o'zgarishi: depozit qaytarildi",
          createdBy: currentUser._id,
        },
      ]);
    }
    driver.depositRemaining = 0;
    driver.depositInitial = 0;
    driver.tariff = TARIFFS.NO_DEPOSIT;
    // Sinovsiz: o'tish sanasidan cashback fazasi boshlanadi.
    driver.startDate = now;
    driver.trialEndedAt = now;
    historyEntry.depositReturned = refund;
  }

  driver.tariffHistory.push(historyEntry);
  await driver.save();

  // Yangi depozitsiz tarif uchun oyliklarni yaratamiz.
  if (driver.tariff === TARIFFS.NO_DEPOSIT) {
    const { ensureOyliklar } = await import("../../oyliklar/services/oyliklar.service.js");
    await ensureOyliklar(driver, new Date());
  }

  return driver;
};

export const getBalance = async (id) => {
  const driver = await Driver.findById(id).populate(
    "car",
    "plateNumber model dailyPaymentDeposit dailyPaymentNoDeposit monthlyCashback",
  );
  if (!driver) throw new ApiError(404, "Haydovchi topilmadi");
  if (!driver.car) throw new ApiError(409, "Haydovchiga mashina biriktirilmagan");
  const phase = getActiveTariffPhase(driver, driver.car);
  const result = {
    driver,
    phase,
    tariff: driver.tariff,
    totalDebt: driver.totalDebt,
    warnings: [],
  };

  if (driver.tariff === TARIFFS.DEPOSIT) {
    result.deposit = {
      initial: driver.depositInitial,
      remaining: driver.depositRemaining,
    };
    const threshold = DEPOSIT_WARN_THRESHOLD;
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
      const overpay = Math.max(0, oylik.paidTotal - oylik.expectedPlanTotal);
      const deductions = planDeficit + oylik.finesTotal + oylik.damagesTotal;
      const earnedPayout = Math.max(0, oylik.salary - deductions + overpay);
      const remainingPayout = Math.max(0, earnedPayout - oylik.paidOut);
      const debt = Math.max(0, deductions - oylik.salary - overpay);
      const isLate = Date.now() > new Date(oylik.dueDate).getTime();
      const lateDays = isLate ? Math.floor((Date.now() - new Date(oylik.dueDate).getTime()) / 86_400_000) : 0;
      result.oylik = {
        ...oylik.toJSON(),
        planDeficit,
        overpay,
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
  const threshold = DEPOSIT_WARN_THRESHOLD;
  const today = startOfDayTashkent(new Date());

  const depositLow = await Driver.find({
    tariff: TARIFFS.DEPOSIT,
    status: DRIVER_STATUS.ACTIVE,
    depositRemaining: { $gt: 0, $lt: threshold },
  })
    .populate("car", "plateNumber model photoUrl")
    .sort({ depositRemaining: 1 });

  const depositEmpty = await Driver.find({
    tariff: TARIFFS.DEPOSIT,
    status: DRIVER_STATUS.ACTIVE,
    depositRemaining: { $lte: 0 },
  })
    .populate("car", "plateNumber model photoUrl")
    .sort({ depositRemaining: 1 });

  const activeDrivers = await Driver.find({ status: DRIVER_STATUS.ACTIVE })
    .populate("car", "plateNumber model photoUrl");
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
    .populate("car", "plateNumber model photoUrl")
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
