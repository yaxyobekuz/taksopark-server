import mongoose from "mongoose";

export const OYLIK_STATUS = Object.freeze({
  ACTIVE: "active",
  CLOSED: "closed",
});

const payoutSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 1 },
    paidAt: { type: Date, required: true, default: Date.now },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

const oylikSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true },
    oylikNumber: { type: Number, required: true, min: 1 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },

    expectedPlanTotal: { type: Number, required: true, min: 0 },
    salary: { type: Number, required: true, min: 0 },

    paidTotal: { type: Number, default: 0, min: 0 },
    finesTotal: { type: Number, default: 0, min: 0 },
    damagesTotal: { type: Number, default: 0, min: 0 },

    carryIn: { type: Number, default: 0 },
    carryOut: { type: Number, default: 0 },

    payouts: { type: [payoutSchema], default: [] },
    paidOut: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: Object.values(OYLIK_STATUS),
      default: OYLIK_STATUS.ACTIVE,
      index: true,
    },

    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closedPlanDeficit: { type: Number, default: 0 },
    closedDeductions: { type: Number, default: 0 },
    closedEarnedPayout: { type: Number, default: 0 },
    closedLateDays: { type: Number, default: 0 },
  },
  { timestamps: true },
);

oylikSchema.index({ driver: 1, oylikNumber: 1 }, { unique: true });
oylikSchema.index({ driver: 1, status: 1 });
oylikSchema.index({ status: 1, dueDate: 1 });

oylikSchema.virtual("planDeficit").get(function () {
  return Math.max(0, this.expectedPlanTotal - this.paidTotal);
});
oylikSchema.virtual("deductions").get(function () {
  return this.planDeficit + this.finesTotal + this.damagesTotal;
});
oylikSchema.virtual("earnedPayout").get(function () {
  return Math.max(0, this.salary + this.carryIn - this.deductions);
});
oylikSchema.virtual("remainingPayout").get(function () {
  return Math.max(0, this.earnedPayout - this.paidOut);
});
oylikSchema.virtual("isLate").get(function () {
  if (this.status !== OYLIK_STATUS.ACTIVE) return false;
  return Date.now() > this.dueDate.getTime();
});
oylikSchema.virtual("lateDays").get(function () {
  if (!this.isLate) return 0;
  return Math.floor((Date.now() - this.dueDate.getTime()) / 86_400_000);
});

oylikSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

const Oylik = mongoose.model("Oylik", oylikSchema);

export default Oylik;
