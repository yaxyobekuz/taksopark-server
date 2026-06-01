import Transaction, {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_WALLETS,
} from "../../../models/transaction.model.js";
import { startOfDayTashkent, endOfDayTashkent } from "../../../utils/timezone.js";

const emptyWalletStat = () => ({ in: 0, out: 0, net: 0, openingBalance: 0, closingBalance: 0 });

const walletAggregation = async (matchStage) => {
  return Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { wallet: "$wallet", direction: "$direction" },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);
};

// 4 ta hamyon uchun davr balansi (oldindan kelgan, ushbu davr, joriy balans).
export const overview = async ({ fromDate, toDate }) => {
  const from = fromDate ? startOfDayTashkent(fromDate) : null;
  const to = toDate ? endOfDayTashkent(toDate) : null;

  const result = {};
  for (const w of Object.values(TRANSACTION_WALLETS)) result[w] = emptyWalletStat();

  // Davr oldidan kelgan balans (opening).
  if (from) {
    const before = await walletAggregation({ date: { $lt: from } });
    for (const r of before) {
      const w = r._id.wallet;
      if (!result[w]) continue;
      if (r._id.direction === TRANSACTION_DIRECTIONS.IN) result[w].openingBalance += r.amount;
      else result[w].openingBalance -= r.amount;
    }
  }

  // Davr ichidagi tranzaksiyalar.
  const periodMatch = {};
  if (from || to) {
    periodMatch.date = {};
    if (from) periodMatch.date.$gte = from;
    if (to) periodMatch.date.$lte = to;
  }
  const period = await walletAggregation(periodMatch);
  for (const r of period) {
    const w = r._id.wallet;
    if (!result[w]) continue;
    if (r._id.direction === TRANSACTION_DIRECTIONS.IN) result[w].in += r.amount;
    else result[w].out += r.amount;
  }

  for (const w of Object.keys(result)) {
    result[w].net = result[w].in - result[w].out;
    result[w].closingBalance = result[w].openingBalance + result[w].net;
  }

  return { wallets: result, from, to };
};

// Bitta hamyon uchun oxirgi tranzaksiyalar (preview).
export const recentForWallet = async (wallet, limit = 5) => {
  const items = await Transaction.find({ wallet })
    .populate("driver", "firstName lastName phone")
    .sort({ date: -1, createdAt: -1 })
    .limit(limit);
  return items;
};

// 4 hamyon yig'indisi (integrity check).
export const integrity = async () => {
  const all = await walletAggregation({});
  let inSum = 0;
  let outSum = 0;
  for (const r of all) {
    if (r._id.direction === TRANSACTION_DIRECTIONS.IN) inSum += r.amount;
    else outSum += r.amount;
  }
  return { totalIn: inSum, totalOut: outSum, diff: inSum - outSum };
};
