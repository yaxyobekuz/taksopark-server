import mongoose from "mongoose";
import { ALL_TARIFFS } from "../constants/tariffs.js";

export const DRIVER_STATUS = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
});

const driverDocumentFileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, default: "" },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false },
);

const driverDocumentSchema = new mongoose.Schema(
  {
    documentType: { type: mongoose.Schema.Types.ObjectId, ref: "DriverDocumentType", required: true },
    expiryDate: { type: Date, default: null },
    files: { type: [driverDocumentFileSchema], default: [] },
  },
  { _id: true, timestamps: true },
);

const tariffHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: ALL_TARIFFS, required: true },
    to: { type: String, enum: ALL_TARIFFS, required: true },
    at: { type: Date, required: true, default: Date.now },
    depositReturned: { type: Number, default: 0 },
    cashbackToDeposit: { type: Number, default: 0 },
    debtCarried: { type: Number, default: 0 },
    note: { type: String, default: "" },
  },
  { _id: true, timestamps: false },
);

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
    trialEndedAt: { type: Date, default: null },

    depositInitial: { type: Number, default: 0, min: 0 },
    depositRemaining: { type: Number, default: 0, index: true },

    totalDebt: { type: Number, default: 0, min: 0, index: true },
    tariffHistory: { type: [tariffHistorySchema], default: [] },

    status: {
      type: String,
      enum: Object.values(DRIVER_STATUS),
      default: DRIVER_STATUS.ACTIVE,
      index: true,
    },

    notes: { type: String, default: "" },
    documents: { type: [driverDocumentSchema], default: [] },
  },
  { timestamps: true },
);

driverSchema.index({ "documents.expiryDate": 1 });

driverSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;
