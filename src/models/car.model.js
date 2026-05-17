import mongoose from "mongoose";

const carSchema = new mongoose.Schema(
  {
    plateNumber: { type: String, trim: true, unique: true, sparse: true, default: null },
    model: { type: String, trim: true, required: true },
    notes: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    currentDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
  },
  { timestamps: true },
);

carSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Car = mongoose.model("Car", carSchema);

export default Car;
