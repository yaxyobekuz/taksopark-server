import TransactionCategory from "../../../models/transactionCategory.model.js";
import Transaction from "../../../models/transaction.model.js";
import ApiError from "../../../utils/ApiError.js";

export const list = async ({ type } = {}) => {
  const filter = {};
  if (type) filter.type = type;
  return TransactionCategory.find(filter).sort({ name: 1 });
};

export const create = async ({ name, type }) => {
  const trimmed = name.trim();
  const exists = await TransactionCategory.findOne({ name: trimmed, type });
  if (exists) throw new ApiError(409, "Bunday nomli kategoriya mavjud");
  return TransactionCategory.create({ name: trimmed, type });
};

export const update = async (id, { name }) => {
  const doc = await TransactionCategory.findById(id);
  if (!doc) throw new ApiError(404, "Kategoriya topilmadi");
  const trimmed = name.trim();
  const dupe = await TransactionCategory.findOne({ name: trimmed, type: doc.type, _id: { $ne: id } });
  if (dupe) throw new ApiError(409, "Bunday nomli kategoriya mavjud");
  doc.name = trimmed;
  await doc.save();
  return doc;
};

export const remove = async (id) => {
  const doc = await TransactionCategory.findById(id);
  if (!doc) throw new ApiError(404, "Kategoriya topilmadi");
  const usedBy = await Transaction.countDocuments({ category: doc.name, type: doc.type });
  if (usedBy > 0) {
    throw new ApiError(409, "Bu kategoriya bo'yicha tranzaksiyalar mavjud, o'chirib bo'lmaydi");
  }
  await doc.deleteOne();
  return { _id: id };
};
