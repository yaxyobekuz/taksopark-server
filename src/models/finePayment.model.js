import mongoose from "mongoose";

export const PAYMENT_SOURCES = Object.freeze({
  DRIVER_CASH: "driver_cash",
  DEPOSIT: "deposit",
});

const finePaymentSchema = new mongoose.Schema(
  {
    fine: { type: mongoose.Schema.Types.ObjectId, ref: "Fine", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    source: { type: String, enum: Object.values(PAYMENT_SOURCES), required: true },
    paidAt: { type: Date, required: true, default: Date.now },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

finePaymentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const FinePayment = mongoose.model("FinePayment", finePaymentSchema);

export default FinePayment;
