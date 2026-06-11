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

const fineSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    issueDate: { type: Date, required: true, default: Date.now },
    attachments: {
      type: [attachmentSchema],
      validate: [(v) => Array.isArray(v) && v.length > 0, "Kamida 1 ta fayl majburiy"],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

fineSchema.index({ driver: 1, issueDate: -1 });
fineSchema.index({ car: 1, issueDate: -1 });

fineSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Fine = mongoose.model("Fine", fineSchema);

export default Fine;
