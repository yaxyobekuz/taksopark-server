import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: true },
);

const damageSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    incidentDate: { type: Date, required: true, default: Date.now },
    oylik: { type: mongoose.Schema.Types.ObjectId, ref: "Oylik", default: null, index: true },
    attachments: {
      type: [attachmentSchema],
      validate: [(v) => Array.isArray(v) && v.length > 0, "Kamida 1 ta fayl majburiy"],
    },
    paidAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ["pending", "partial", "paid"], default: "pending", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

damageSchema.index({ driver: 1, incidentDate: -1 });
damageSchema.index({ car: 1, incidentDate: -1 });

damageSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Damage = mongoose.model("Damage", damageSchema);

export default Damage;
