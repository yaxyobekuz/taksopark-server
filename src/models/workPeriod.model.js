import mongoose from "mongoose";

// Statik 2 tarif: depozitli va keshbekli. Haydovchi bir vaqtda faqat bittada.
export const TARIFF = Object.freeze({
  DEPOSIT: "deposit",
  CASHBACK: "cashback",
});

// Haydovchining bir tarifda ishlagan vaqt oralig'i (mashinaga bog'liq EMAS).
// endDate = null bo'lsa - davr ochiq, haydovchi hozir shu tarifda ishlayapti.
const workPeriodSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },
    tariff: {
      type: String,
      enum: Object.values(TARIFF),
      required: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, default: null },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

workPeriodSchema.index({ driver: 1, startDate: 1 });

workPeriodSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const WorkPeriod = mongoose.model("WorkPeriod", workPeriodSchema);

export default WorkPeriod;
