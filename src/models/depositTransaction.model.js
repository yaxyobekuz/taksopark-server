import mongoose from "mongoose";

export const DEPOSIT_TX_TYPE = Object.freeze({
  IN: "in", // depozitga kirim (haydovchi qo'ydi / ortiqcha to'lovdan)
  OUT: "out", // depozitdan chiqim (yechib olindi / jarima qoplandi)
});

// Depozit harakati - APPEND-ONLY (§9). Depozit BALANSI saqlanmaydi - u har doim
// shu tranzaksiyalardan DERIVED: balans = Σ(in) − Σ(out) (§10 ANTI-QOIDA).
// Xato yozuvni tuzatish = teskari turdagi yangi yozuv (reverses bilan bog'lanadi).
// coverage — chiqim avtomatik qaysi majburiyatni qoplaganini ko'rsatadi (kunlik/jarima/zarar).
// Qo'lda kirim/chiqimda coverage=null, auto=false.
const coverageSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["daily", "fine", "damage"], required: true },
    ref: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: Date, default: null },
  },
  { _id: false },
);

const depositTransactionSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    type: { type: String, enum: Object.values(DEPOSIT_TX_TYPE), required: true },
    amount: { type: Number, required: true, min: 0 },
    reverses: { type: mongoose.Schema.Types.ObjectId, ref: "DepositTransaction", default: null },
    coverage: { type: coverageSchema, default: null },
    auto: { type: Boolean, default: false },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

depositTransactionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const DepositTransaction = mongoose.model("DepositTransaction", depositTransactionSchema);

export default DepositTransaction;
