import ApiError from "./ApiError.js";

export const toSom = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) throw new ApiError(400, "Summa noto'g'ri");
  if (!Number.isInteger(value)) throw new ApiError(400, "Summa butun son bo'lishi kerak");
  if (value < 0) throw new ApiError(400, "Summa manfiy bo'la olmaydi");
  return value;
};
