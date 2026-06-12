import Car from "../../../models/car.model.js";
import CarDocumentType from "../../../models/carDocumentType.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { removeFileByUrl, fileToPublicUrl } from "../../../utils/fileStorage.js";
import * as workPeriodsService from "../../workPeriods/services/workPeriods.service.js";
import * as carPricesService from "../../carPrices/services/carPrices.service.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Faol narx davridan ro'yxat/detalda ko'rsatiladigan yengil nusxa.
const pickActivePrice = (period) =>
  period
    ? {
        _id: period._id,
        dailyRateDeposit: period.dailyRateDeposit,
        dailyRateCashback: period.dailyRateCashback,
        monthlyCashback: period.monthlyCashback,
        startDate: period.startDate,
        endDate: period.endDate,
      }
    : null;

// Mashinalar ro'yxatiga bugun faol narx davrini (DERIVED holat) biriktiradi.
const attachActivePrices = async (cars) => {
  const priceMap = await carPricesService.activePricesByCar(cars.map((c) => c._id));
  return cars.map((car) => {
    const obj = car.toJSON();
    obj.activePrice = pickActivePrice(priceMap.get(String(car._id)));
    return obj;
  });
};

const populateDocs = (q) =>
  q.populate("documents.documentType", "name").populate(
    "currentDriver",
    "firstName lastName phone photoUrl",
  );

// currentDriver'ga joriy ish davrini (DERIVED holat uchun) biriktiradi.
const decorateCarDriver = async (car) => {
  if (!car?.currentDriver) return car;
  const obj = car.toJSON();
  const activeMap = await workPeriodsService.activePeriodsByDriver([obj.currentDriver._id]);
  const active = activeMap.get(String(obj.currentDriver._id));
  obj.currentDriver.currentPeriod = active
    ? { _id: active._id, tariff: active.tariff, startDate: active.startDate, endDate: active.endDate }
    : null;
  return obj;
};

export const list = async ({ search, isActive, page = 1, limit = 20 }) => {
  const filter = {};
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ plateNumber: rx }, { model: rx }];
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Car.find(filter)
      .populate("currentDriver", "firstName lastName phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Car.countDocuments(filter),
  ]);
  return { items: await attachActivePrices(items), total };
};

export const getById = async (id) => {
  const car = await populateDocs(Car.findById(id));
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  const decorated = await decorateCarDriver(car);
  const obj = typeof decorated.toJSON === "function" ? decorated.toJSON() : decorated;
  const priceMap = await carPricesService.activePricesByCar([obj._id]);
  obj.activePrice = pickActivePrice(priceMap.get(String(obj._id)));
  return obj;
};

export const create = async (body) => {
  const plate = body.plateNumber?.trim() || null;
  if (plate) {
    const exists = await Car.findOne({ plateNumber: plate });
    if (exists) throw new ApiError(409, "Bunday raqamli mashina allaqachon mavjud");
  }
  return Car.create({
    plateNumber: plate,
    model: body.model,
    notes: body.notes || "",
    photoUrl: body.photoUrl || "",
  });
};

export const update = async (id, body) => {
  const car = await Car.findById(id);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  if (body.plateNumber !== undefined) {
    const plate = body.plateNumber?.trim() || null;
    if (plate) {
      const dupe = await Car.findOne({
        plateNumber: plate,
        _id: { $ne: car._id },
      });
      if (dupe) throw new ApiError(409, "Bunday raqamli mashina allaqachon mavjud");
    }
    car.plateNumber = plate;
  }
  if (body.model !== undefined) car.model = body.model;
  if (body.notes !== undefined) car.notes = body.notes;
  if (body.isActive !== undefined) car.isActive = body.isActive;

  let oldPhotoUrl = null;
  if (body.photoUrl !== undefined && body.photoUrl !== car.photoUrl) {
    oldPhotoUrl = car.photoUrl;
    car.photoUrl = body.photoUrl;
  }

  await car.save();
  if (oldPhotoUrl) removeFileByUrl(oldPhotoUrl);
  return populateDocs(Car.findById(car._id));
};

export const listExpiring = async ({ limit = 5, days = 30 }) => {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const cars = await Car.find({
    isActive: true,
    documents: {
      $elemMatch: { expiryDate: { $ne: null, $lte: cutoff } },
    },
  })
    .populate("documents.documentType", "name")
    .populate("currentDriver", "firstName lastName phone")
    .lean();

  const enriched = cars
    .map((c) => {
      const expiring = (c.documents || [])
        .filter((d) => d.expiryDate)
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
      if (!expiring) return null;
      return { ...c, expiringDocument: expiring };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(a.expiringDocument.expiryDate) -
        new Date(b.expiringDocument.expiryDate),
    );

  return enriched.slice(0, limit);
};

export const softRemove = async (id) => {
  const car = await Car.findById(id);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  if (car.currentDriver) {
    const driver = await Driver.findById(car.currentDriver);
    if (driver) {
      throw new ApiError(409, "Mashinaga haydovchi biriktirilgan. Avval haydovchini ajrating");
    }
  }
  car.isActive = false;
  await car.save();
  return car;
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

export const addDocument = async (
  carId,
  { documentType, expiryDate },
  files = [],
) => {
  const car = await Car.findById(carId);
  if (!car) {
    cleanupUploadedFiles(files);
    throw new ApiError(404, "Mashina topilmadi");
  }
  const typeDoc = await CarDocumentType.findById(documentType);
  if (!typeDoc) {
    cleanupUploadedFiles(files);
    throw new ApiError(404, "Hujjat turi topilmadi");
  }
  car.documents.push({
    documentType,
    expiryDate: expiryDate || null,
    files: buildFilesPayload(files),
  });
  await car.save();
  return populateDocs(Car.findById(car._id));
};

export const updateDocument = async (
  carId,
  docId,
  { expiryDate, removeFileUrls = [] },
  files = [],
) => {
  const car = await Car.findById(carId);
  if (!car) {
    cleanupUploadedFiles(files);
    throw new ApiError(404, "Mashina topilmadi");
  }
  const doc = car.documents.id(docId);
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

  await car.save();
  return populateDocs(Car.findById(car._id));
};

export const removeDocument = async (carId, docId) => {
  const car = await Car.findById(carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  const doc = car.documents.id(docId);
  if (!doc) throw new ApiError(404, "Hujjat topilmadi");
  for (const f of doc.files || []) removeFileByUrl(f.url);
  doc.deleteOne();
  await car.save();
  return populateDocs(Car.findById(car._id));
};
