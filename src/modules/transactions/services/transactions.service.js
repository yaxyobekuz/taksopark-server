import Transaction, { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../../../models/transaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent, endOfDayTashkent } from "../../../utils/timezone.js";

export const list = async ({ type, source, driverId, fromDate, toDate, page = 1, limit = 20 }) => {
  const filter = {};
  if (type) filter.type = type;
  if (source) filter.source = source;
  if (driverId) filter.driver = driverId;
  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = startOfDayTashkent(fromDate);
    if (toDate) filter.date.$lte = endOfDayTashkent(toDate);
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .populate("driver", "firstName lastName phone")
      .populate("fine", "amount issueDate")
      .populate("damage", "amount incidentDate")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(filter),
  ]);
  return { items, total };
};

export const summary = async ({ fromDate, toDate }) => {
  const match = {};
  if (fromDate || toDate) {
    match.date = {};
    if (fromDate) match.date.$gte = startOfDayTashkent(fromDate);
    if (toDate) match.date.$lte = endOfDayTashkent(toDate);
  }
  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: { type: "$type", source: "$source" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  let income = 0;
  let expense = 0;
  const bySource = {};
  for (const r of rows) {
    if (r._id.type === TRANSACTION_TYPES.INCOME) income += r.amount;
    else expense += r.amount;
    bySource[r._id.source] = (bySource[r._id.source] || 0) + r.amount;
  }
  return { income, expense, balance: income - expense, bySource };
};

export const create = async (body, currentUser) => {
  if (body.source !== TRANSACTION_SOURCES.MANUAL) {
    throw new ApiError(400, "Faqat qo'lda kirim/chiqim qo'shish mumkin");
  }
  if (!body.category || !body.category.trim()) {
    throw new ApiError(400, "Kategoriya kerak");
  }
  const tx = await Transaction.create({
    type: body.type,
    source: TRANSACTION_SOURCES.MANUAL,
    category: body.category.trim(),
    amount: body.amount,
    date: body.date ? new Date(body.date) : new Date(),
    note: body.note || "",
    createdBy: currentUser._id,
  });
  return tx;
};

export const remove = async (id) => {
  const tx = await Transaction.findById(id);
  if (!tx) throw new ApiError(404, "Tranzaksiya topilmadi");
  if (tx.source !== TRANSACTION_SOURCES.MANUAL) {
    throw new ApiError(409, "Avtomat tranzaksiyalarni o'chirib bo'lmaydi. To'lovni bekor qiling");
  }
  await tx.deleteOne();
};
