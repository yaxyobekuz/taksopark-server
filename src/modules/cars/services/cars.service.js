import Car from "../../../models/car.model.js";
import CarDocumentType from "../../../models/carDocumentType.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";
import { removeFileByUrl, fileToPublicUrl } from "../../../utils/fileStorage.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const populateDocs = (q) =>
  q.populate("documents.documentType", "name").populate(
    "currentDriver",
    "firstName lastName phone status tariff photoUrl startDate depositRemaining depositInitial",
  );

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
      .populate("currentDriver", "firstName lastName phone status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Car.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const car = await populateDocs(Car.findById(id));
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  return car;
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
    if (driver && driver.status === "active") {
      throw new ApiError(409, "Mashinaga faol haydovchi biriktirilgan. Avval haydovchini ajrating");
    }
  }
  car.isActive = false;
  await car.save();
  return car;
};

const buildFileAttachment = (file) => {
  if (!file) return null;
  return {
    url: fileToPublicUrl(file),
    filename: file.originalname,
    mime: file.mimetype,
    size: file.size,
  };
};

export const addDocument = async (carId, { documentType, expiryDate }, file) => {
  const car = await Car.findById(carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  const typeDoc = await CarDocumentType.findById(documentType);
  if (!typeDoc) {
    if (file) removeFileByUrl(buildFileAttachment(file)?.url);
    throw new ApiError(404, "Hujjat turi topilmadi");
  }
  car.documents.push({
    documentType,
    expiryDate: expiryDate || null,
    file: buildFileAttachment(file),
  });
  await car.save();
  return populateDocs(Car.findById(car._id));
};

export const updateDocument = async (
  carId,
  docId,
  { expiryDate, removeFile },
  file,
) => {
  const car = await Car.findById(carId);
  if (!car) {
    if (file) removeFileByUrl(buildFileAttachment(file)?.url);
    throw new ApiError(404, "Mashina topilmadi");
  }
  const doc = car.documents.id(docId);
  if (!doc) {
    if (file) removeFileByUrl(buildFileAttachment(file)?.url);
    throw new ApiError(404, "Hujjat topilmadi");
  }

  if (expiryDate !== undefined) doc.expiryDate = expiryDate || null;

  if (file) {
    if (doc.file?.url) removeFileByUrl(doc.file.url);
    doc.file = buildFileAttachment(file);
  } else if (removeFile) {
    if (doc.file?.url) removeFileByUrl(doc.file.url);
    doc.file = null;
  }

  await car.save();
  return populateDocs(Car.findById(car._id));
};

export const removeDocument = async (carId, docId) => {
  const car = await Car.findById(carId);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  const doc = car.documents.id(docId);
  if (!doc) throw new ApiError(404, "Hujjat topilmadi");
  if (doc.file?.url) removeFileByUrl(doc.file.url);
  doc.deleteOne();
  await car.save();
  return populateDocs(Car.findById(car._id));
};
