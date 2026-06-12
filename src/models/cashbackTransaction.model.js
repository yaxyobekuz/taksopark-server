import mongoose from "mongoose";

export const CASHBACK_TX_TYPE = Object.freeze({
  PAYOUT: "payout", // haydovchiga keshbek berildi (avans / to'lov)
  REVERSAL: "reversal", // tuzatuvchi (xato payout'ni qaytaruvchi)
});

// Keshbek harakati - APPEND-ONLY (§9). Keshbek "hisoblangan summasi" SAQLANMAYDI -
// u har doim kunlik plan snapshotlaridan (§8 kunlik ulush) DERIVED hisoblanadi.
// Bu model faqat haydovchiga BERILGAN keshbekni (payout/avans) yozadi.
// monthStart - qaysi keshbek oyidan olingani (anchor: keshbek davri boshidan oylar).
const cashbackTransactionSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    monthStart: { type: Date, required: true },
    type: { type: String, enum: Object.values(CASHBACK_TX_TYPE), required: true },
    amount: { type: Number, required: true, min: 0 },
    reverses: { type: mongoose.Schema.Types.ObjectId, ref: "CashbackTransaction", default: null },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

cashbackTransactionSchema.index({ driver: 1, monthStart: 1 });

cashbackTransactionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const CashbackTransaction = mongoose.model("CashbackTransaction", cashbackTransactionSchema);

export default CashbackTransaction;
