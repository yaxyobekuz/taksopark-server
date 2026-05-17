import mongoose from "mongoose";
import { ALL_TARIFFS } from "../constants/tariffs.js";

export const DRIVER_STATUS = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
});

const driverSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, unique: true, required: true },
    passportSeries: { type: String, trim: true, default: "" },
    licenseNumber: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    birthDate: { type: Date, default: null },
    photoUrl: { type: String, default: "" },

    tariff: { type: String, enum: ALL_TARIFFS, required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", default: null, index: true },
    startDate: { type: Date, required: true },

    depositInitial: { type: Number, default: 0, min: 0 },
    depositRemaining: { type: Number, default: 0, index: true },

    status: {
      type: String,
      enum: Object.values(DRIVER_STATUS),
      default: DRIVER_STATUS.ACTIVE,
      index: true,
    },

    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

driverSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;
