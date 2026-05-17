export const TARIFFS = Object.freeze({
  DEPOSIT: "deposit",
  NO_DEPOSIT: "no_deposit",
});

export const ALL_TARIFFS = Object.values(TARIFFS);

export const TARIFF_CONFIG = Object.freeze({
  [TARIFFS.DEPOSIT]: {
    depositInitial: 2_500_000,
    dailyPlan: 500_000,
    depositWarnThreshold: 500_000,
    hasSalary: false,
    trialDays: 0,
    monthlySalary: 0,
  },
  [TARIFFS.NO_DEPOSIT]: {
    depositInitial: 0,
    dailyPlan: 560_000,
    depositWarnThreshold: 0,
    hasSalary: true,
    trialDays: 7,
    monthlySalary: 5_500_000,
  },
});

export const TARIFF_LABELS = Object.freeze({
  [TARIFFS.DEPOSIT]: "Depozitli",
  [TARIFFS.NO_DEPOSIT]: "Depozitsiz",
});
