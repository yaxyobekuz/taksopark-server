// Asia/Tashkent fixed UTC+5, no DST
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

export const startOfDayTashkent = (input) => {
  const d = input instanceof Date ? new Date(input) : new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  const shifted = new Date(d.getTime() + TZ_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - TZ_OFFSET_MS);
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

// Tashkent kuni bo'yicha N oy qo'shadi (Tashkent oy-KUNINI saqlaydi; nishon oy qisqa
// bo'lsa oxirgi kunga qisadi) va Tashkent yarim tunini qaytaradi.
// MUHIM: avval UTC komponentlari bilan ishlardi - lekin Tashkent yarim tuni UTC'da
// OLDINGI kun 19:00 bo'lgani uchun (UTC+5), oy boshi (Tashkent 1-kun) UTC'da oldingi
// oyning 30/31-kuni bo'lib ko'rinardi. Natijada "keyingi oy boshi" 1 kun kam hisoblanib,
// 31 kunlik oylar oxirgi kuni (31-may) oylik ko'rinishdan TUSHIB QOLARDI. Endi hisob
// Tashkent kalendar maydonida bajariladi.
export const addMonths = (date, months) => {
  const shifted = new Date(startOfDayTashkent(date).getTime() + TZ_OFFSET_MS); // UTC maydonlari = Tashkent Y/M/D
  const targetDay = shifted.getUTCDate();
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(targetDay, lastDay));
  return new Date(shifted.getTime() - TZ_OFFSET_MS);
};

export const daysBetween = (from, to) => {
  const a = startOfDayTashkent(from).getTime();
  const b = startOfDayTashkent(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
};

export const endOfDayTashkent = (input) => {
  const d = startOfDayTashkent(input);
  return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
};

// Tashkent kuni "YYYY-MM-DD" ko'rinishida (TZ-ga bog'liq emas).
export const dateKeyTashkent = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
};
