import mongoose from "mongoose";

// Bir mashinaga belgilangan narx amal qilgan oraliq (mashina narx davri).
// Bitta davr IKKALA tarif narxini birga saqlaydi (depozit + keshbek), shuning
// uchun mashina uchun yagona timeline - overlap va ochiq davr shu `car` bo'yicha.
// endDate = null bo'lsa davr ochiq (hozir amaldagi narx).
// dailyRateDeposit  - depozitli tarif uchun kunlik to'lov narxi.
// dailyRateCashback - keshbekli tarif uchun kunlik to'lov narxi.
// monthlyCashback   - keshbekli tarifdagi haydovchiga beriladigan oylik keshbek narxi.
const carPriceSchema = new mongoose.Schema(
  {
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true,
      index: true,
    },
    dailyRateDeposit: { type: Number, required: true, min: 0 },
    dailyRateCashback: { type: Number, required: true, min: 0 },
    monthlyCashback: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, default: null },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

carPriceSchema.index({ car: 1, startDate: 1 });

carPriceSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const CarPrice = mongoose.model("CarPrice", carPriceSchema);

export default CarPrice;
