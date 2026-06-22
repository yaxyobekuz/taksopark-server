import mongoose from "mongoose";

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

    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", default: null, index: true },

    // Kunlik to'lov qarzini depozit/keshbekdan AVTOMATIK qoplash yoqilganmi (§10).
    // O'chirilganda settleDriver bu haydovchining KUNLIK majburiyatlarini qoplamaydi
    // (jarima/zarar baribir qoplanadi). Bu admin auto-qoplangan kunni o'chirib, ish/
    // narx/biriktirish davrini tahrirlashga imkon beradi - aks holda pul qaytishi
    // bilanoq settlement uni qayta qoplab "loop" hosil qilardi.
    autoSettleDaily: { type: Boolean, default: true },

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
