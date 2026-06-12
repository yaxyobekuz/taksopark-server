import mongoose from "mongoose";

export const DEPOSIT_TX_TYPE = Object.freeze({
  IN: "in", // depozitga kirim (haydovchi qo'ydi / ortiqcha to'lovdan)
  OUT: "out", // depozitdan chiqim (yechib olindi / jarima qoplandi)
});

// Depozit harakati — APPEND-ONLY (§9). Depozit BALANSI saqlanmaydi — u har doim
// shu tranzaksiyalardan DERIVED: balans = Σ(in) − Σ(out) (§10 ANTI-QOIDA).
// Xato yozuvni tuzatish = teskari turdagi yangi yozuv (reverses bilan bog'lanadi).
const depositTransactionSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    type: { type: String, enum: Object.values(DEPOSIT_TX_TYPE), required: true },
    amount: { type: Number, required: true, min: 0 },
    reverses: { type: mongoose.Schema.Types.ObjectId, ref: "DepositTransaction", default: null },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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
