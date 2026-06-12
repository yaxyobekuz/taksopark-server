import mongoose from "mongoose";

// Tranzaksiya turlari. Hozircha kunlik to'lov + tuzatuvchi (reversal).
// Kelajakda kengayadi: depozitga/balansga ortiqcha, depozitdan yechish, keshbek,
// jarima/zarar qoplash, qarz va h.k. (§9, §10).
export const TX_TYPE = Object.freeze({
  PAYMENT: "payment", // kunlik to'lov
  REVERSAL: "reversal", // tuzatuvchi (xato to'lovni teskari qaytaruvchi)
});

// To'lov manbasi: haydovchi naqd berdi / depozitdan / keshbekdan qoplandi (§10).
export const TX_SOURCE = Object.freeze({
  DRIVER: "driver",
  DEPOSIT: "deposit",
  CASHBACK: "cashback",
});

// Bitta pul harakati = bitta yozuv. APPEND-ONLY: yaratilgach o'zgartirilmaydi va
// o'chirilmaydi (§9). Xato bo'lsa - teskari (reversal) tranzaksiya qo'shiladi.
// Kunlik planga BOG'LANADI (1 plan : N tranzaksiya). Kun uchun "to'langan summa" =
// shu planga bog'langan tranzaksiyalar yig'indisi (payment − reversal).
const transactionSchema = new mongoose.Schema(
  {
    dailyPlan: { type: mongoose.Schema.Types.ObjectId, ref: "DailyPlan", required: true, index: true },
    // Tezkor so'rovlar uchun denormalizatsiya (manba baribir dailyPlan).
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    date: { type: Date, required: true }, // plan kuni (Tashkent start-of-day)

    type: { type: String, enum: Object.values(TX_TYPE), required: true },
    source: { type: String, enum: Object.values(TX_SOURCE), default: TX_SOURCE.DRIVER },
    amount: { type: Number, required: true, min: 0 }, // doim musbat; effekt turdan kelib chiqadi

    // reversal bo'lsa - qaysi tranzaksiyani tuzatayotgani (audit izi).
    reverses: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },

    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

transactionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
