import Transaction, {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_TYPES,
  TRANSACTION_SOURCES,
  TRANSACTION_WALLETS,
} from "../../../models/transaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import { startOfDayTashkent, endOfDayTashkent } from "../../../utils/timezone.js";

export const list = async ({ type, source, wallet, driverId, fromDate, toDate, page = 1, limit = 20 }) => {
  const filter = {};
  if (type) filter.type = type;
  if (source) filter.source = source;
  if (wallet) filter.wallet = wallet;
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

export const summary = async ({ fromDate, toDate, wallet }) => {
  const match = {};
  if (fromDate || toDate) {
    match.date = {};
    if (fromDate) match.date.$gte = startOfDayTashkent(fromDate);
    if (toDate) match.date.$lte = endOfDayTashkent(toDate);
  }
  if (wallet) match.wallet = wallet;
  const rows = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { wallet: "$wallet", direction: "$direction" },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);
  const byWallet = {};
  for (const wKey of Object.values(TRANSACTION_WALLETS)) {
    byWallet[wKey] = { in: 0, out: 0, net: 0 };
  }
  for (const r of rows) {
    const w = r._id.wallet;
    if (!byWallet[w]) continue;
    if (r._id.direction === TRANSACTION_DIRECTIONS.IN) byWallet[w].in += r.amount;
    else byWallet[w].out += r.amount;
  }
  for (const w of Object.keys(byWallet)) {
    byWallet[w].net = byWallet[w].in - byWallet[w].out;
  }
  const revenue = byWallet[TRANSACTION_WALLETS.REVENUE];
  return {
    byWallet,
    income: revenue.in,
    expense: revenue.out,
    balance: revenue.in - revenue.out,
  };
};

export const create = async (body, currentUser) => {
  if (body.source !== TRANSACTION_SOURCES.MANUAL) {
    throw new ApiError(400, "Faqat qo'lda kirim/chiqim qo'shish mumkin");
  }
  if (!body.category || !body.category.trim()) {
    throw new ApiError(400, "Kategoriya kerak");
  }
  const direction =
    body.type === TRANSACTION_TYPES.INCOME
      ? TRANSACTION_DIRECTIONS.IN
      : TRANSACTION_DIRECTIONS.OUT;
  const tx = await Transaction.create({
    type: body.type,
    direction,
    wallet: TRANSACTION_WALLETS.REVENUE,
    source: TRANSACTION_SOURCES.MANUAL,
    category: body.category.trim(),
    amount: body.amount,
    date: body.date ? new Date(body.date) : new Date(),
    note: body.note || "",
    createdBy: currentUser._id,
  });
  return tx;
};

export const update = async (id, body) => {
  const tx = await Transaction.findById(id);
  if (!tx) throw new ApiError(404, "Tranzaksiya topilmadi");
  if (tx.source !== TRANSACTION_SOURCES.MANUAL) {
    throw new ApiError(409, "Avtomat tranzaksiyalarni tahrirlab bo'lmaydi");
  }
  if (!body.category || !body.category.trim()) {
    throw new ApiError(400, "Kategoriya kerak");
  }
  tx.type = body.type;
  tx.direction =
    body.type === TRANSACTION_TYPES.INCOME
      ? TRANSACTION_DIRECTIONS.IN
      : TRANSACTION_DIRECTIONS.OUT;
  tx.category = body.category.trim();
  tx.amount = body.amount;
  if (body.date) tx.date = new Date(body.date);
  tx.note = body.note || "";
  await tx.save();
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
