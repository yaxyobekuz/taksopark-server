import mongoose from "mongoose";
import Transaction, {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_TYPES,
  TRANSACTION_WALLETS,
} from "../models/transaction.model.js";

// Direction'ga qarab type avtomatik. Park daromad hamyonida in=income, out=expense.
// Boshqa hamyonlar uchun ham bir xil pattern (kassa harakati nuqtai nazaridan).
const deriveType = (direction) =>
  direction === TRANSACTION_DIRECTIONS.IN
    ? TRANSACTION_TYPES.INCOME
    : TRANSACTION_TYPES.EXPENSE;

// Bitta hamyon tranzaksiyasini yozadi.
export const writeWalletTx = async (entry) => {
  const doc = {
    wallet: entry.wallet,
    direction: entry.direction,
    type: deriveType(entry.direction),
    source: entry.source,
    amount: entry.amount,
    date: entry.date || new Date(),
    driver: entry.driver || null,
    dailyPayment: entry.dailyPayment || null,
    fine: entry.fine || null,
    damage: entry.damage || null,
    finePayment: entry.finePayment || null,
    damagePayment: entry.damagePayment || null,
    oylik: entry.oylik || null,
    payoutId: entry.payoutId || null,
    category: entry.category || "",
    note: entry.note || "",
    createdBy: entry.createdBy,
    linkedTxId: entry.linkedTxId || null,
  };
  return Transaction.create(doc);
};

// Bir nechta hamyonni bog'lab yozadi (linkedTxId bir xil). Bo'sh massiv qaytaradi
// agar entries hammasi amount <= 0.
export const writeLinkedTxs = async (entries) => {
  const valid = entries.filter((e) => e && e.amount > 0);
  if (valid.length === 0) return [];
  const linkedTxId = new mongoose.Types.ObjectId();
  const docs = await Promise.all(
    valid.map((entry) => writeWalletTx({ ...entry, linkedTxId })),
  );
  return docs;
};

export { TRANSACTION_WALLETS, TRANSACTION_DIRECTIONS };
