// Permission keys (the seed writes the same keys to the DB)
export const PERMISSIONS = Object.freeze({
  USERS_READ: "users.read",
  ACTIVITY_LOGS_READ: "activity_logs.read",

  DRIVERS_READ: "drivers.read",
  DRIVERS_CREATE: "drivers.create",
  DRIVERS_UPDATE: "drivers.update",
  DRIVERS_DELETE: "drivers.delete",
  DRIVERS_END_TRIAL: "drivers.end_trial",
  DRIVERS_DOCUMENTS_MANAGE: "drivers.documents.manage",

  CARS_READ: "cars.read",
  CARS_CREATE: "cars.create",
  CARS_UPDATE: "cars.update",
  CARS_DELETE: "cars.delete",
  CARS_DOCUMENTS_MANAGE: "cars.documents.manage",

  PAYMENTS_READ: "payments.read",
  PAYMENTS_CREATE: "payments.create",
  PAYMENTS_UPDATE: "payments.update",
  PAYMENTS_DELETE: "payments.delete",

  FINES_READ: "fines.read",
  FINES_CREATE: "fines.create",
  FINES_UPDATE: "fines.update",
  FINES_DELETE: "fines.delete",

  DAMAGES_READ: "damages.read",
  DAMAGES_CREATE: "damages.create",
  DAMAGES_UPDATE: "damages.update",
  DAMAGES_DELETE: "damages.delete",

  OYLIKLAR_READ: "oyliklar.read",
  OYLIKLAR_PAYOUT: "oyliklar.payout",

  FINES_PAY: "fines.pay",
  DAMAGES_PAY: "damages.pay",

  TRANSACTIONS_READ: "transactions.read",
  TRANSACTIONS_CREATE: "transactions.create",
  TRANSACTIONS_DELETE: "transactions.delete",

  REPORTS_READ: "reports.read",
});

export const PERMISSION_LABELS = {
  [PERMISSIONS.USERS_READ]: { label: "Foydalanuvchilarni ko'rish", group: "users" },
  [PERMISSIONS.ACTIVITY_LOGS_READ]: { label: "Faoliyat loglarini ko'rish", group: "audit" },

  [PERMISSIONS.DRIVERS_READ]: { label: "Haydovchilarni ko'rish", group: "drivers" },
  [PERMISSIONS.DRIVERS_CREATE]: { label: "Haydovchi qo'shish", group: "drivers" },
  [PERMISSIONS.DRIVERS_UPDATE]: { label: "Haydovchini tahrirlash", group: "drivers" },
  [PERMISSIONS.DRIVERS_DELETE]: { label: "Haydovchini o'chirish", group: "drivers" },
  [PERMISSIONS.DRIVERS_END_TRIAL]: { label: "Sinov muddatini tugatish", group: "drivers" },
  [PERMISSIONS.DRIVERS_DOCUMENTS_MANAGE]: { label: "Haydovchi hujjat turlarini boshqarish", group: "drivers" },

  [PERMISSIONS.CARS_READ]: { label: "Mashinalarni ko'rish", group: "cars" },
  [PERMISSIONS.CARS_CREATE]: { label: "Mashina qo'shish", group: "cars" },
  [PERMISSIONS.CARS_UPDATE]: { label: "Mashinani tahrirlash", group: "cars" },
  [PERMISSIONS.CARS_DELETE]: { label: "Mashinani o'chirish", group: "cars" },
  [PERMISSIONS.CARS_DOCUMENTS_MANAGE]: { label: "Mashina hujjat turlarini boshqarish", group: "cars" },

  [PERMISSIONS.PAYMENTS_READ]: { label: "Kunlik to'lovlarni ko'rish", group: "payments" },
  [PERMISSIONS.PAYMENTS_CREATE]: { label: "Kunlik to'lov qo'shish", group: "payments" },
  [PERMISSIONS.PAYMENTS_UPDATE]: { label: "Kunlik to'lovni tahrirlash", group: "payments" },
  [PERMISSIONS.PAYMENTS_DELETE]: { label: "Kunlik to'lovni o'chirish", group: "payments" },

  [PERMISSIONS.FINES_READ]: { label: "Jarimalarni ko'rish", group: "fines" },
  [PERMISSIONS.FINES_CREATE]: { label: "Jarima qo'shish", group: "fines" },
  [PERMISSIONS.FINES_UPDATE]: { label: "Jarimani tahrirlash", group: "fines" },
  [PERMISSIONS.FINES_DELETE]: { label: "Jarimani o'chirish", group: "fines" },

  [PERMISSIONS.DAMAGES_READ]: { label: "Zararlarni ko'rish", group: "damages" },
  [PERMISSIONS.DAMAGES_CREATE]: { label: "Zarar qo'shish", group: "damages" },
  [PERMISSIONS.DAMAGES_UPDATE]: { label: "Zararni tahrirlash", group: "damages" },
  [PERMISSIONS.DAMAGES_DELETE]: { label: "Zararni o'chirish", group: "damages" },

  [PERMISSIONS.OYLIKLAR_READ]: { label: "Oyliklarni ko'rish", group: "oyliklar" },
  [PERMISSIONS.OYLIKLAR_PAYOUT]: { label: "Oylik haqini berish", group: "oyliklar" },

  [PERMISSIONS.FINES_PAY]: { label: "Jarimani to'lash", group: "fines" },
  [PERMISSIONS.DAMAGES_PAY]: { label: "Zararni to'lash", group: "damages" },

  [PERMISSIONS.TRANSACTIONS_READ]: { label: "Kirim-Chiqimni ko'rish", group: "transactions" },
  [PERMISSIONS.TRANSACTIONS_CREATE]: { label: "Kirim-Chiqim qo'shish", group: "transactions" },
  [PERMISSIONS.TRANSACTIONS_DELETE]: { label: "Kirim-Chiqimni o'chirish", group: "transactions" },

  [PERMISSIONS.REPORTS_READ]: { label: "Hisobotlarni ko'rish", group: "reports" },
};
