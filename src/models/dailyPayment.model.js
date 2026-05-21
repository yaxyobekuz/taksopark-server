import mongoose from "mongoose";
import { ALL_TARIFFS } from "../constants/tariffs.js";

const dailyPaymentSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    expectedPlan: { type: Number, required: true, min: 0 },
    tariffSnapshot: { type: String, enum: ALL_TARIFFS, required: true },
    oylik: { type: mongoose.Schema.Types.ObjectId, ref: "Oylik", default: null, index: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

dailyPaymentSchema.index({ driver: 1, date: 1 }, { unique: true });
dailyPaymentSchema.index({ car: 1, date: 1 });

dailyPaymentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const DailyPayment = mongoose.model("DailyPayment", dailyPaymentSchema);

export default DailyPayment;
