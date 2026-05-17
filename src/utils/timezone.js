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

export const addMonths = (date, months) => {
  const d = new Date(date);
  const targetMonth = d.getUTCMonth() + months;
  const targetDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(targetDay, lastDay));
  return d;
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
