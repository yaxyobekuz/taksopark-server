import mongoose from "mongoose";

const carDocumentTypeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, unique: true, required: true },
  },
  { timestamps: true },
);

carDocumentTypeSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const CarDocumentType = mongoose.model("CarDocumentType", carDocumentTypeSchema);

export default CarDocumentType;
