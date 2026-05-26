import mongoose from "mongoose";

const driverDocumentTypeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, unique: true, required: true },
  },
  { timestamps: true },
);

driverDocumentTypeSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const DriverDocumentType = mongoose.model("DriverDocumentType", driverDocumentTypeSchema);

export default DriverDocumentType;
