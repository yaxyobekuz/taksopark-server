import mongoose from "mongoose";

export const TRANSACTION_TYPES = Object.freeze({
  INCOME: "income",
  EXPENSE: "expense",
});

export const TRANSACTION_SOURCES = Object.freeze({
  DAILY_PAYMENT: "daily_payment",
  FINE_PAYMENT_CASH: "fine_payment_cash",
  FINE_PAYMENT_DEPOSIT: "fine_payment_deposit",
  DAMAGE_PAYMENT_CASH: "damage_payment_cash",
  DAMAGE_PAYMENT_DEPOSIT: "damage_payment_deposit",
  FINE_SYSTEM: "fine_system",
  DAMAGE_SYSTEM: "damage_system",
  OYLIK_PAYOUT: "oylik_payout",
  MANUAL: "manual",
});

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(TRANSACTION_TYPES), required: true, index: true },
    source: { type: String, enum: Object.values(TRANSACTION_SOURCES), required: true, index: true },
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

transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ driver: 1, date: -1 });

transactionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
