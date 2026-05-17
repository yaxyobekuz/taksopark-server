import mongoose from "mongoose";

export const CYCLE_STATUS = Object.freeze({
  OPEN: "open",
  SETTLED: "settled",
});

const monthlyCycleSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true },
    cycleNumber: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    expectedPlanTotal: { type: Number, required: true, min: 0 },
    salary: { type: Number, required: true, min: 0 },

    paidTotal: { type: Number, default: 0, min: 0 },
    finesTotal: { type: Number, default: 0, min: 0 },
    damagesTotal: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: Object.values(CYCLE_STATUS),
      default: CYCLE_STATUS.OPEN,
      index: true,
    },
    settledAt: { type: Date, default: null },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    planDeficit: { type: Number, default: 0, min: 0 },
    finalPayout: { type: Number, default: 0, min: 0 },
    debtCarried: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

monthlyCycleSchema.index({ driver: 1, cycleNumber: 1 }, { unique: true });
monthlyCycleSchema.index({ driver: 1, status: 1 });

monthlyCycleSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const MonthlyCycle = mongoose.model("MonthlyCycle", monthlyCycleSchema);

export default MonthlyCycle;
