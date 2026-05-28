import mongoose from "mongoose";
import { TRANSACTION_TYPES } from "./transaction.model.js";

const transactionCategorySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    type: { type: String, enum: Object.values(TRANSACTION_TYPES), required: true, index: true },
  },
  { timestamps: true },
);

transactionCategorySchema.index({ type: 1, name: 1 }, { unique: true });

transactionCategorySchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const TransactionCategory = mongoose.model("TransactionCategory", transactionCategorySchema);

export default TransactionCategory;
