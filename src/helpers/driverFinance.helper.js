import Oylik from "../models/oylik.model.js";
import { TARIFFS } from "../constants/tariffs.js";

// Depozit deltasi: deficit ushlanganda manfiy, ortiqcha to'lovda musbat.
// Manfiy delta depozitni kamaytiradi, 0 dan oshsa qarzga yoziladi.
// Musbat delta avval mavjud qarzni qoplaydi, qolgani depozitga qo'shiladi.
export const applyDepositDelta = async (driver, delta) => {
  if (driver.tariff !== TARIFFS.DEPOSIT) return;
  if (delta < 0) {
    const raw = driver.depositRemaining + delta;
    if (raw < 0) {
      driver.totalDebt += -raw;
      driver.depositRemaining = 0;
    } else {
      driver.depositRemaining = raw;
    }
  } else {
    const debtPayoff = Math.min(driver.totalDebt, delta);
    driver.totalDebt -= debtPayoff;
    driver.depositRemaining += delta - debtPayoff;
  }
  await driver.save();
};

// Oylik cashback dan ushlash. kind: "fine" yoki "damage".
// Salaryning ishlatilmagan qismidan summani inc qiladi, qaytadigan inc qiymatini qaytaradi.
// oylikId yo'q yoki oylik topilmasa 0.
export const collectFromOylik = async (amount, kind, oylikId) => {
  if (!oylikId || amount <= 0) return 0;
  const oylik = await Oylik.findById(oylikId);
  if (!oylik) return 0;
  const planDeficit = Math.max(0, oylik.expectedPlanTotal - oylik.paidTotal);
  const usedDeductions = planDeficit + oylik.finesTotal + oylik.damagesTotal;
  const available = Math.max(0, oylik.salary - usedDeductions);
  const inc = Math.min(amount, available);
  if (inc <= 0) return 0;
  const field = kind === "damage" ? "damagesTotal" : "finesTotal";
  await Oylik.updateOne({ _id: oylik._id }, { $inc: { [field]: inc } });
  return inc;
};
