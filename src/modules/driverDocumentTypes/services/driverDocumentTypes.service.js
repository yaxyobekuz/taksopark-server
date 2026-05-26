import DriverDocumentType from "../../../models/driverDocumentType.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";

export const list = async () => {
  return DriverDocumentType.find().sort({ name: 1 });
};

export const create = async ({ name }) => {
  const exists = await DriverDocumentType.findOne({ name: name.trim() });
  if (exists) throw new ApiError(409, "Bunday nomli hujjat turi mavjud");
  return DriverDocumentType.create({ name: name.trim() });
};

export const update = async (id, { name }) => {
  const doc = await DriverDocumentType.findById(id);
  if (!doc) throw new ApiError(404, "Hujjat turi topilmadi");
  const trimmed = name.trim();
  const dupe = await DriverDocumentType.findOne({ name: trimmed, _id: { $ne: id } });
  if (dupe) throw new ApiError(409, "Bunday nomli hujjat turi mavjud");
  doc.name = trimmed;
  await doc.save();
  return doc;
};

export const remove = async (id) => {
  const doc = await DriverDocumentType.findById(id);
  if (!doc) throw new ApiError(404, "Hujjat turi topilmadi");
  const usedBy = await Driver.countDocuments({ "documents.documentType": id });
  if (usedBy > 0) {
    throw new ApiError(409, "Bu hujjat turi haydovchilarda ishlatilmoqda");
  }
  await doc.deleteOne();
  return { _id: id };
};
