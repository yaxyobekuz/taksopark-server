import mongoose from "mongoose";

export const TRANSACTION_TYPES = Object.freeze({
  INCOME: "income",
  EXPENSE: "expense",
});

export const TRANSACTION_DIRECTIONS = Object.freeze({
  IN: "in",
  OUT: "out",
});

export const TRANSACTION_WALLETS = Object.freeze({
  DEPOSIT: "deposit",
  DEBT: "debt",
  REVENUE: "revenue",
  EXTERNAL: "external",
});

export const TRANSACTION_SOURCES = Object.freeze({
  DAILY_PAYMENT: "daily_payment",
  FINE_ISSUED: "fine_issued",
  DAMAGE_ISSUED: "damage_issued",
  FINE_DEPOSIT_DEDUCT: "fine_deposit_deduct",
  DAMAGE_DEPOSIT_DEDUCT: "damage_deposit_deduct",
  FINE_OYLIK_DEDUCT: "fine_oylik_deduct",
  DAMAGE_OYLIK_DEDUCT: "damage_oylik_deduct",
  FINE_DEBT_RECORD: "fine_debt_record",
  DAMAGE_DEBT_RECORD: "damage_debt_record",
  DEBT_REPAY_CASH: "debt_repay_cash",
  DEBT_REPAY_DEPOSIT: "debt_repay_deposit",
  DEBT_REPAY_OYLIK: "debt_repay_oylik",
  OYLIK_PAYOUT: "oylik_payout",
  DEPOSIT_TOPUP: "deposit_topup",
  DEPOSIT_WITHDRAW: "deposit_withdraw",
  DEPOSIT_REFUND: "deposit_refund",
  MANUAL: "manual",
});

const transactionSchema = new mongoose.Schema(
  {
    wallet: { type: String, enum: Object.values(TRANSACTION_WALLETS), required: true, index: true },
    direction: { type: String, enum: Object.values(TRANSACTION_DIRECTIONS), required: true, index: true },
    type: { type: String, enum: Object.values(TRANSACTION_TYPES), required: true, index: true },
    source: { type: String, enum: Object.values(TRANSACTION_SOURCES), required: true, index: true },
    linkedTxId: { type: mongoose.Schema.Types.ObjectId, default: null },
    category: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true, default: Date.now, index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    dailyPayment: { type: mongoose.Schema.Types.ObjectId, ref: "DailyPayment", default: null },
    fine: { type: mongoose.Schema.Types.ObjectId, ref: "Fine", default: null },
    damage: { type: mongoose.Schema.Types.ObjectId, ref: "Damage", default: null },
    finePayment: { type: mongoose.Schema.Types.ObjectId, ref: "FinePayment", default: null },
    damagePayment: { type: mongoose.Schema.Types.ObjectId, ref: "DamagePayment", default: null },
    oylik: { type: mongoose.Schema.Types.ObjectId, ref: "Oylik", default: null, index: true },
    payoutId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

transactionSchema.index({ wallet: 1, date: -1 });
transactionSchema.index({ driver: 1, date: -1 });
transactionSchema.index({ linkedTxId: 1 });

transactionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
