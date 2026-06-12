// Permission keys (the seed writes the same keys to the DB)
export const PERMISSIONS = Object.freeze({
  USERS_READ: "users.read",
  ACTIVITY_LOGS_READ: "activity_logs.read",

  ADMINS_READ: "admins.read",
  ADMINS_CREATE: "admins.create",
  ADMINS_UPDATE: "admins.update",
  ADMINS_DELETE: "admins.delete",

  DRIVERS_READ: "drivers.read",
  DRIVERS_CREATE: "drivers.create",
  DRIVERS_UPDATE: "drivers.update",
  DRIVERS_DOCUMENTS_MANAGE: "drivers.documents.manage",

  WORK_PERIODS_READ: "work_periods.read",
  WORK_PERIODS_MANAGE: "work_periods.manage",

  REST_DAYS_READ: "rest_days.read",
  REST_DAYS_MANAGE: "rest_days.manage",

  CARS_READ: "cars.read",
  CARS_CREATE: "cars.create",
  CARS_UPDATE: "cars.update",
  CARS_DELETE: "cars.delete",
  CARS_DOCUMENTS_MANAGE: "cars.documents.manage",

  CAR_PRICES_READ: "car_prices.read",
  CAR_PRICES_MANAGE: "car_prices.manage",

  FINES_READ: "fines.read",
  FINES_CREATE: "fines.create",
  FINES_UPDATE: "fines.update",
  FINES_DELETE: "fines.delete",

  DAMAGES_READ: "damages.read",
  DAMAGES_CREATE: "damages.create",
  DAMAGES_UPDATE: "damages.update",
  DAMAGES_DELETE: "damages.delete",
});

export const PERMISSION_LABELS = {
  [PERMISSIONS.USERS_READ]: { label: "Foydalanuvchilarni ko'rish", group: "users" },
  [PERMISSIONS.ACTIVITY_LOGS_READ]: { label: "Faoliyat loglarini ko'rish", group: "audit" },

  [PERMISSIONS.ADMINS_READ]: { label: "Adminlarni ko'rish", group: "admins" },
  [PERMISSIONS.ADMINS_CREATE]: { label: "Admin qo'shish", group: "admins" },
  [PERMISSIONS.ADMINS_UPDATE]: { label: "Adminni tahrirlash", group: "admins" },
  [PERMISSIONS.ADMINS_DELETE]: { label: "Adminni o'chirish", group: "admins" },

  [PERMISSIONS.DRIVERS_READ]: { label: "Haydovchilarni ko'rish", group: "drivers" },
  [PERMISSIONS.DRIVERS_CREATE]: { label: "Haydovchi qo'shish", group: "drivers" },
  [PERMISSIONS.DRIVERS_UPDATE]: { label: "Haydovchini tahrirlash", group: "drivers" },
  [PERMISSIONS.DRIVERS_DOCUMENTS_MANAGE]: { label: "Haydovchi hujjat turlarini boshqarish", group: "drivers" },

  [PERMISSIONS.WORK_PERIODS_READ]: { label: "Ish davrlarini ko'rish", group: "work_periods" },
  [PERMISSIONS.WORK_PERIODS_MANAGE]: { label: "Ish davrlarini boshqarish", group: "work_periods" },

  [PERMISSIONS.REST_DAYS_READ]: { label: "Dam olish kunlarini ko'rish", group: "rest_days" },
  [PERMISSIONS.REST_DAYS_MANAGE]: { label: "Dam olish kunlarini boshqarish", group: "rest_days" },

  [PERMISSIONS.CARS_READ]: { label: "Mashinalarni ko'rish", group: "cars" },
  [PERMISSIONS.CARS_CREATE]: { label: "Mashina qo'shish", group: "cars" },
  [PERMISSIONS.CARS_UPDATE]: { label: "Mashinani tahrirlash", group: "cars" },
  [PERMISSIONS.CARS_DELETE]: { label: "Mashinani o'chirish", group: "cars" },
  [PERMISSIONS.CARS_DOCUMENTS_MANAGE]: { label: "Mashina hujjat turlarini boshqarish", group: "cars" },

  [PERMISSIONS.CAR_PRICES_READ]: { label: "Mashina narxlarini ko'rish", group: "cars" },
  [PERMISSIONS.CAR_PRICES_MANAGE]: { label: "Mashina narxlarini boshqarish", group: "cars" },

  [PERMISSIONS.FINES_READ]: { label: "Jarimalarni ko'rish", group: "fines" },
  [PERMISSIONS.FINES_CREATE]: { label: "Jarima qo'shish", group: "fines" },
  [PERMISSIONS.FINES_UPDATE]: { label: "Jarimani tahrirlash", group: "fines" },
  [PERMISSIONS.FINES_DELETE]: { label: "Jarimani o'chirish", group: "fines" },

  [PERMISSIONS.DAMAGES_READ]: { label: "Zararlarni ko'rish", group: "damages" },
  [PERMISSIONS.DAMAGES_CREATE]: { label: "Zarar qo'shish", group: "damages" },
  [PERMISSIONS.DAMAGES_UPDATE]: { label: "Zararni tahrirlash", group: "damages" },
  [PERMISSIONS.DAMAGES_DELETE]: { label: "Zararni o'chirish", group: "damages" },
};
