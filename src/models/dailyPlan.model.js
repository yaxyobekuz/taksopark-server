import mongoose from "mongoose";

// Kunlik plan - bir haydovchi + bir kun uchun YAGONA model; o'sha kungi hisob-kitobning
// HAQIQAT MANBASI (§1). O'sha kun amalda bo'lgan bog'liqliklar bu yerga SNAPSHOT qilinadi:
// id (relation) + raw (qiymat nusxasi). Hisobot doim raw qiymatdan o'qiydi, jonli joindan EMAS.
//
// planAmount - o'sha kun uchun majburiyat (raw snapshot): dam olish kuni => 0,
//   aks holda o'sha kungi tarif bo'yicha kunlik narx.
// To'langan summa va qarz bu modelda SAQLANMAYDI - ular tranzaksiyalardan DERIVED
// hisoblanadi (§9, §10). priceMissing - o'sha kunga narx davri topilmagani.
const dailyPlanSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    date: { type: Date, required: true },
    // Tashkent kuni "YYYY-MM-DD" - TZ siljishidan himoyalangan unikal kalit.
    dateKey: { type: String, required: true },

    // --- Ish davri snapshot ---
    workPeriod: { type: mongoose.Schema.Types.ObjectId, ref: "WorkPeriod", required: true },
    tariff: { type: String, required: true }, // raw: deposit | cashback

    // --- Mashina snapshot ---
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", default: null },
    carSnapshot: {
      plateNumber: { type: String, default: "" },
      model: { type: String, default: "" },
    },

    // --- Narx davri snapshot ---
    carPrice: { type: mongoose.Schema.Types.ObjectId, ref: "CarPrice", default: null },
    dailyRate: { type: Number, default: 0 }, // raw: o'sha kungi tarif bo'yicha kunlik narx
    monthlyCashback: { type: Number, default: 0 }, // raw: keyingi keshbek hisobi uchun
    priceMissing: { type: Boolean, default: false },

    // --- Dam olish kuni snapshot ---
    isRestDay: { type: Boolean, default: false },
    restDay: { type: mongoose.Schema.Types.ObjectId, ref: "RestDay", default: null },

    // --- Hisoblangan majburiyat (raw snapshot) ---
    planAmount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Bir kun uchun bir haydovchiga FAQAT bitta plan (ikki marta yaratilmasligi shart).
dailyPlanSchema.index({ driver: 1, dateKey: 1 }, { unique: true });
dailyPlanSchema.index({ workPeriod: 1 });
dailyPlanSchema.index({ carPrice: 1 });

dailyPlanSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const DailyPlan = mongoose.model("DailyPlan", dailyPlanSchema);

export default DailyPlan;
