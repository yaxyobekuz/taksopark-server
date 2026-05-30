import mongoose from "mongoose";

const restDaySchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    date: { type: Date, required: true, index: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

restDaySchema.index({ driver: 1, date: 1 }, { unique: true });

restDaySchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const RestDay = mongoose.model("RestDay", restDaySchema);

export default RestDay;
