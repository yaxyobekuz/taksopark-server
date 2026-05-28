export const TARIFFS = Object.freeze({
  DEPOSIT: "deposit",
  NO_DEPOSIT: "no_deposit",
});

export const ALL_TARIFFS = Object.values(TARIFFS);

// Narx (kunlik to'lov, oylik cashback) endi mashinada saqlanadi. Bu yerda faqat
// tarifga xos metadata qoladi.
export const TARIFF_CONFIG = Object.freeze({
  [TARIFFS.DEPOSIT]: {
    hasTrial: false,
    hasCashback: false,
    trialDays: 0,
  },
  [TARIFFS.NO_DEPOSIT]: {
    hasTrial: true,
    hasCashback: true,
    trialDays: 7,
  },
});

// Depozit past ogohlantirish chegarasi (park darajasida, mashinaga bog'liq emas).
export const DEPOSIT_WARN_THRESHOLD = 500_000;

export const TARIFF_LABELS = Object.freeze({
  [TARIFFS.DEPOSIT]: "Depozitli",
  [TARIFFS.NO_DEPOSIT]: "Depozitsiz",
});
