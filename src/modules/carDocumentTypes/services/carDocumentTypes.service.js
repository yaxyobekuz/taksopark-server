import CarDocumentType from "../../../models/carDocumentType.model.js";
import Car from "../../../models/car.model.js";
import ApiError from "../../../utils/ApiError.js";

export const list = async () => {
  return CarDocumentType.find().sort({ name: 1 });
};

export const create = async ({ name }) => {
  const exists = await CarDocumentType.findOne({ name: name.trim() });
  if (exists) throw new ApiError(409, "Bunday nomli hujjat turi mavjud");
  return CarDocumentType.create({ name: name.trim() });
};

export const update = async (id, { name }) => {
  const doc = await CarDocumentType.findById(id);
  if (!doc) throw new ApiError(404, "Hujjat turi topilmadi");
  const trimmed = name.trim();
  const dupe = await CarDocumentType.findOne({ name: trimmed, _id: { $ne: id } });
  if (dupe) throw new ApiError(409, "Bunday nomli hujjat turi mavjud");
  doc.name = trimmed;
  await doc.save();
  return doc;
};

export const remove = async (id) => {
  const doc = await CarDocumentType.findById(id);
  if (!doc) throw new ApiError(404, "Hujjat turi topilmadi");
  const usedBy = await Car.countDocuments({ "documents.documentType": id });
  if (usedBy > 0) {
    throw new ApiError(409, "Bu hujjat turi mashinalarda ishlatilmoqda");
  }
  await doc.deleteOne();
  return { _id: id };
};
