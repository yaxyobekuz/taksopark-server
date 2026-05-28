import bcrypt from "bcrypt";

const ROUNDS = 10;

export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);

export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

// Plaintext parolni tekshiradi; eski (bcrypt) foydalanuvchilar uchun fallback.
export const verifyPassword = async (plain, user) => {
  if (user?.password != null && user.password !== "") return plain === user.password;
  if (user?.passwordHash) return comparePassword(plain, user.passwordHash);
  return false;
};
