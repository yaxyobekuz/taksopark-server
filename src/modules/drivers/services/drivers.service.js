import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import Car from "../../../models/car.model.js";
import DriverDocumentType from "../../../models/driverDocumentType.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent } from "../../../utils/timezone.js";
import { removeFileByUrl, fileToPublicUrl } from "../../../utils/fileStorage.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

export const list = async ({ status, carId, search, page = 1, limit = 20 }) => {
  const filter = {};
  if (status) filter.status = status;
  if (carId) filter.car = carId;
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
  const exists = await Driver.findOne({ phone: body.phone });
  if (exists) throw new ApiError(409, "Bu telefon raqamli haydovchi mavjud");
  const driver = new Driver({
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    startDate: startOfDayTashkent(body.startDate),
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
