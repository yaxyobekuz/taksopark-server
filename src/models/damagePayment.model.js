import mongoose from "mongoose";
import { PAYMENT_SOURCES } from "./finePayment.model.js";

const damagePaymentSchema = new mongoose.Schema(
  {
    damage: { type: mongoose.Schema.Types.ObjectId, ref: "Damage", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    source: { type: String, enum: Object.values(PAYMENT_SOURCES), required: true },
    paidAt: { type: Date, required: true, default: Date.now },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

damagePaymentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const DamagePayment = mongoose.model("DamagePayment", damagePaymentSchema);

export default DamagePayment;
