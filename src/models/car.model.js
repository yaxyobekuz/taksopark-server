import mongoose from "mongoose";

const carDocumentFileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, default: "" },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false },
);

const carDocumentSchema = new mongoose.Schema(
  {
    documentType: { type: mongoose.Schema.Types.ObjectId, ref: "CarDocumentType", required: true },
    expiryDate: { type: Date, default: null },
    file: { type: carDocumentFileSchema, default: null },
  },
  { _id: true, timestamps: true },
);

const carSchema = new mongoose.Schema(
  {
    plateNumber: { type: String, trim: true, unique: true, sparse: true, default: null },
    model: { type: String, trim: true, required: true },
    notes: { type: String, trim: true, default: "" },
    photoUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    currentDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    documents: { type: [carDocumentSchema], default: [] },
  },
  { timestamps: true },
);

carSchema.index({ "documents.expiryDate": 1 });

carSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Car = mongoose.model("Car", carSchema);

export default Car;
